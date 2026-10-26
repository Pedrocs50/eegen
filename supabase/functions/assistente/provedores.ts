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

/**
 * Quanto esperar cada modelo, em segundos. Sem prazo, um Gemini travado prendia o professor até o Supabase cortar a
 * função (150 s), sem resposta e sem registro. Em geracoes_ia (19 a 25/10/2026) o principal levou até 105 s quando
 * respondia, enquanto o de reserva respondia em 7 a 12 s; então o principal tem pouco tempo e o reserva, folga.
 * Dá para mudar sem mexer no código, pelos segredos LIMITE_PRINCIPAL_S e LIMITE_RESERVA_S.
 */
const LIMITE_PRINCIPAL_S = 35;
const LIMITE_RESERVA_S = 60;

/** Erros em que vale tentar de novo ou trocar de modelo: cota por minuto (429), sobrecarga (503) ou prazo estourado (504). */
const temporario = (erro: unknown) => erro instanceof ErroHttp && (erro.status === 429 || erro.status === 503 || erro.status === 504);

/** fetch com prazo: estourou, vira o erro 504 (em vez de esperar para sempre). */
async function pedirComPrazo(fetchFn: typeof fetch, url: string, init: RequestInit, limiteS: number, quem: string) {
  try {
    const resposta = await fetchFn(url, { ...init, signal: AbortSignal.timeout(limiteS * 1000) });
    return { resposta, dados: await resposta.json().catch(() => ({})) };
  } catch (erro) {
    const nome = (erro as Error).name;
    if (nome === "TimeoutError" || nome === "AbortError") throw new ErroHttp(504, `${quem} não respondeu em ${limiteS} s.`);
    throw erro;
  }
}

async function chamarGemini(modelo: string, sistema: string, mensagens: Mensagem[], chave: string, fetchFn: typeof fetch, limiteS: number): Promise<Resultado> {
  const pedir = (comPensamento: boolean) =>
    pedirComPrazo(fetchFn, `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
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
    }, limiteS, `O Gemini (${modelo})`);
  let { resposta, dados } = await pedir(geminiAceitaPensamento);
  if (resposta.status === 400 && geminiAceitaPensamento && /thinking/i.test(JSON.stringify(dados))) {
    geminiAceitaPensamento = false;
    ({ resposta, dados } = await pedir(false));
  }
  if (!resposta.ok) {
    const erro = new ErroHttp(resposta.status, `Gemini (${modelo}) respondeu ${resposta.status}: ${JSON.stringify(dados).slice(0, 300)}`);
    throw Object.assign(erro, { espera: esperaSugerida(dados) });
  }
  const texto = (dados.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
  return { texto, tokensEntrada: dados.usageMetadata?.promptTokenCount ?? 0, tokensSaida: dados.usageMetadata?.candidatesTokenCount ?? 0 };
}

async function chamarGroq(modelo: string, sistema: string, mensagens: Mensagem[], chave: string, fetchFn: typeof fetch, limiteS: number): Promise<Resultado> {
  const { resposta, dados } = await pedirComPrazo(fetchFn, "https://api.groq.com/openai/v1/chat/completions", {
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
  }, limiteS, `O Groq (${modelo})`);
  if (!resposta.ok) throw new ErroHttp(resposta.status, `Groq respondeu ${resposta.status}: ${JSON.stringify(dados).slice(0, 300)}`);
  return { texto: dados.choices?.[0]?.message?.content ?? "", tokensEntrada: dados.usage?.prompt_tokens ?? 0, tokensSaida: dados.usage?.completion_tokens ?? 0 };
}

/**
 * Chama o provedor; se estiver sobrecarregado ou sem cota por um instante, espera e tenta mais uma vez.
 * Prazo estourado não repete: já se passou tempo demais.
 */
async function chamarComRepeticao(provedor: string, modelo: string, sistema: string, mensagens: Mensagem[], chave: string, fetchFn: typeof fetch, limiteS: number) {
  const chamar = provedor === "gemini" ? chamarGemini : chamarGroq;
  try {
    return await chamar(modelo, sistema, mensagens, chave, fetchFn, limiteS);
  } catch (erro) {
    const espera = (erro as { espera?: number }).espera ?? 2;
    if (!temporario(erro) || (erro as ErroHttp).status === 504 || espera > 20) throw erro;
    await esperar(espera);
    return await chamar(modelo, sistema, mensagens, chave, fetchFn, limiteS);
  }
}

/**
 * Chama o modelo configurado. No Gemini, sobrecarga, cota estourada ou demora no principal vai direto para o modelo de
 * reserva (tentar o mesmo modelo de novo costumava falhar e só somava espera). O resultado diz qual modelo respondeu.
 */
export async function chamarModelo(config: Config, sistema: string, mensagens: Mensagem[], env: LerAmbiente, fetchFn: typeof fetch = fetch): Promise<Resultado> {
  const chave = env(config.provedor === "gemini" ? "GEMINI_API_KEY" : "GROQ_API_KEY");
  if (!chave) throw new ErroHttp(500, `A chave de API do ${config.provedor} não está configurada nos segredos da Edge Function.`);
  const limite = (nome: string, padrao: number) => Number(env(nome)) || padrao;
  const limitePrincipal = limite("LIMITE_PRINCIPAL_S", LIMITE_PRINCIPAL_S);
  const limiteReserva = limite("LIMITE_RESERVA_S", LIMITE_RESERVA_S);
  if (config.provedor !== "gemini" || config.modelo === MODELO_RESERVA_GEMINI) {
    return { ...(await chamarComRepeticao(config.provedor, config.modelo, sistema, mensagens, chave, fetchFn, limiteReserva)), modelo: config.modelo };
  }
  try {
    return { ...(await chamarGemini(config.modelo, sistema, mensagens, chave, fetchFn, limitePrincipal)), modelo: config.modelo };
  } catch (erro) {
    if (!temporario(erro)) throw erro;
    return { ...(await chamarComRepeticao("gemini", MODELO_RESERVA_GEMINI, sistema, mensagens, chave, fetchFn, limiteReserva)), modelo: MODELO_RESERVA_GEMINI };
  }
}
