// Provedores de IA do assistente (Gemini e Groq), com o mesmo formato de entrada e saída.
// Para usar outro (Claude, por exemplo): uma função chamarX aqui e uma linha em config_ia.

import { ErroHttp, esperaSugerida, esperar, type Config, type LerAmbiente } from "../_shared/http.ts";

type Papel = "professor" | "assistente";
export type Mensagem = { papel: Papel; texto: string };
export type Resultado = { texto: string; tokensEntrada: number; tokensSaida: number; modelo?: string };

/**
 * Modelo de reserva do Gemini: entra quando o principal está sobrecarregado (503) ou sem cota (429).
 * Em 19/10/2026 os modelos Flash ficaram fora por "high demand" enquanto o Flash-Lite respondia normalmente.
 */
export const MODELO_RESERVA_GEMINI = "gemini-3.5-flash-lite";

/**
 * Quanto o Gemini "pensa" antes de responder. Os modelos Flash atuais pensam bastante por padrão, e isso é a maior
 * parte da espera (o professor via 15 a 40 s). Montar uma lista no formato pedido não precisa de raciocínio longo:
 * "low" corta a espera sem a perda de qualidade do modelo Lite. Modelo que não aceitar o ajuste recebe o pedido sem ele.
 */
const PENSAMENTO_GEMINI = "low";
let geminiAceitaPensamento = true;

const temporario = (erro: unknown) => erro instanceof ErroHttp && (erro.status === 429 || erro.status === 503);

async function chamarGemini(modelo: string, sistema: string, mensagens: Mensagem[], chave: string, fetchFn: typeof fetch): Promise<Resultado> {
  const pedir = (comPensamento: boolean) =>
    fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sistema }] },
        contents: mensagens.map((m) => ({ role: m.papel === "professor" ? "user" : "model", parts: [{ text: m.texto }] })),
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.7,
          ...(comPensamento ? { thinkingConfig: { thinkingLevel: PENSAMENTO_GEMINI } } : {}),
        },
      }),
    });
  let resposta = await pedir(geminiAceitaPensamento);
  let dados = await resposta.json().catch(() => ({}));
  if (resposta.status === 400 && geminiAceitaPensamento && /thinking/i.test(JSON.stringify(dados))) {
    geminiAceitaPensamento = false;
    resposta = await pedir(false);
    dados = await resposta.json().catch(() => ({}));
  }
  if (!resposta.ok) {
    const erro = new ErroHttp(resposta.status, `Gemini (${modelo}) respondeu ${resposta.status}: ${JSON.stringify(dados).slice(0, 300)}`);
    throw Object.assign(erro, { espera: esperaSugerida(dados) });
  }
  const texto = (dados.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
  return { texto, tokensEntrada: dados.usageMetadata?.promptTokenCount ?? 0, tokensSaida: dados.usageMetadata?.candidatesTokenCount ?? 0 };
}

async function chamarGroq(modelo: string, sistema: string, mensagens: Mensagem[], chave: string, fetchFn: typeof fetch): Promise<Resultado> {
  const resposta = await fetchFn("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${chave}` },
    body: JSON.stringify({
      model: modelo,
      messages: [
        { role: "system", content: sistema },
        ...mensagens.map((m) => ({ role: m.papel === "professor" ? "user" : "assistant", content: m.texto })),
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    }),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new ErroHttp(resposta.status, `Groq respondeu ${resposta.status}: ${JSON.stringify(dados).slice(0, 300)}`);
  return { texto: dados.choices?.[0]?.message?.content ?? "", tokensEntrada: dados.usage?.prompt_tokens ?? 0, tokensSaida: dados.usage?.completion_tokens ?? 0 };
}

/** Chama o provedor; se estiver sobrecarregado ou sem cota por um instante, espera e tenta mais uma vez. */
async function chamarComRepeticao(provedor: string, modelo: string, sistema: string, mensagens: Mensagem[], chave: string, fetchFn: typeof fetch) {
  const chamar = provedor === "gemini" ? chamarGemini : chamarGroq;
  try {
    return await chamar(modelo, sistema, mensagens, chave, fetchFn);
  } catch (erro) {
    const espera = (erro as { espera?: number }).espera ?? 2;
    if (!temporario(erro) || espera > 20) throw erro;
    await esperar(espera);
    return await chamar(modelo, sistema, mensagens, chave, fetchFn);
  }
}

/**
 * Chama o modelo configurado. No Gemini, sobrecarga ou cota estourada no principal vai direto para o modelo de
 * reserva (tentar o mesmo modelo de novo costumava falhar e só somava espera). O resultado diz qual modelo respondeu.
 */
export async function chamarModelo(config: Config, sistema: string, mensagens: Mensagem[], env: LerAmbiente, fetchFn: typeof fetch = fetch): Promise<Resultado> {
  const chave = env(config.provedor === "gemini" ? "GEMINI_API_KEY" : "GROQ_API_KEY");
  if (!chave) throw new ErroHttp(500, `A chave de API do ${config.provedor} não está configurada nos segredos da Edge Function.`);
  if (config.provedor !== "gemini" || config.modelo === MODELO_RESERVA_GEMINI) {
    return { ...(await chamarComRepeticao(config.provedor, config.modelo, sistema, mensagens, chave, fetchFn)), modelo: config.modelo };
  }
  try {
    return { ...(await chamarGemini(config.modelo, sistema, mensagens, chave, fetchFn)), modelo: config.modelo };
  } catch (erro) {
    if (!temporario(erro)) throw erro;
    return { ...(await chamarComRepeticao("gemini", MODELO_RESERVA_GEMINI, sistema, mensagens, chave, fetchFn)), modelo: MODELO_RESERVA_GEMINI };
  }
}
