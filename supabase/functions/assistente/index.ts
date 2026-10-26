// Edge Function "assistente": chat em que o professor pede listas de exercícios no padrão da UP English.
//
// Fluxo: confere login, papel e cota, e busca a configuração e as listas de exemplo, tudo de uma vez -> monta a
// "base sólida" (regras.ts) -> chama o provedor configurado em config_ia (provedores.ts) -> conserta/valida o
// JSON (resposta.ts) -> registra em geracoes_ia.
//
// Segredos (Supabase -> Edge Functions -> Secrets): GEMINI_API_KEY e, se for usar, GROQ_API_KEY.
// SUPABASE_URL e SUPABASE_ANON_KEY já vêm prontos no ambiente das Edge Functions.
// Publicação: automática pelo GitHub Actions a cada push (.github/workflows/funcoes.yml).

import { clienteSupabase, ErroHttp, json, CORS, prepararGeracao, registrarGeracao, servir, tokenDoPedido, type Config, type LerAmbiente } from "../_shared/http.ts";
import { montarSistema, type Idioma } from "./regras.ts";
import { chamarModelo, type Mensagem } from "./provedores.ts";
import { CAMPOS_PUBLICADAS, interpretarResposta, paraImportacao, type LinhaLista, type RespostaAssistente } from "./resposta.ts";

const CONFIG_PADRAO: Config = { provedor: "gemini", modelo: "gemini-flash-latest", limite_diario: 30 };
const MAX_MENSAGENS = 10;
const MAX_CARACTERES_PEDIDO = 1500;
/** Depois disso, uma resposta fora do formato vira erro em vez de uma segunda chamada ao modelo. */
const TEMPO_PARA_SEGUNDA_CHANCE_MS = 60_000;

/** Lê e confere o pedido do editor: idioma, nível e a conversa (a última mensagem é do professor). */
async function lerPedido(req: Request) {
  const corpo = await req.json().catch(() => ({}));
  const idioma: Idioma = corpo.idioma === "espanhol" || corpo.idioma === "frances" ? corpo.idioma : "ingles";
  const nivel = Math.min(Math.max(Number(corpo.nivel) || 1, 1), 6);
  const mensagens: Mensagem[] = (Array.isArray(corpo.mensagens) ? corpo.mensagens : [])
    .filter((m: Mensagem) => (m?.papel === "professor" || m?.papel === "assistente") && typeof m.texto === "string" && m.texto.trim())
    .slice(-MAX_MENSAGENS);
  if (mensagens.length === 0 || mensagens[mensagens.length - 1].papel !== "professor") {
    throw new ErroHttp(400, "Envie a mensagem do professor.");
  }
  const ultima = mensagens[mensagens.length - 1].texto;
  // Pedidos de exercício são curtos; um texto enorme quase sempre é tentativa de usar o assistente para outra coisa.
  if (ultima.length > MAX_CARACTERES_PEDIDO) {
    throw new ErroHttp(400, `O pedido está muito longo (${ultima.length} caracteres). Descreva os exercícios em até ${MAX_CARACTERES_PEDIDO} caracteres.`);
  }
  return { idioma, nivel, mensagens, ultima };
}

export async function atender(req: Request, env: LerAmbiente, fetchFn: typeof fetch = fetch): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);

  const token = tokenDoPedido(req);
  if (!token) return json({ erro: "Faça login para usar o assistente." }, 401);

  const inicio = Date.now();
  let config = CONFIG_PADRAO;
  let ultimaMensagem = "";
  const supabase = clienteSupabase(env, token, fetchFn);

  try {
    const { idioma, nivel, mensagens, ultima } = await lerPedido(req);
    ultimaMensagem = ultima;

    // Login, papel, configuração, cota e as 2 listas publicadas mais recentes do idioma (exemplos): tudo junto.
    const preparo = await prepararGeracao(
      supabase, "gerar_lista", CONFIG_PADRAO, "O assistente é só para professores e admins.",
      supabase(`/rest/v1/listas?status=eq.publicada&idioma=eq.${idioma}&order=atualizado_em.desc&limit=2&select=${CAMPOS_PUBLICADAS}`),
    );
    config = preparo.config;
    const { usadas } = preparo;
    if (usadas >= config.limite_diario) {
      throw new ErroHttp(429, `Você já usou as ${config.limite_diario} gerações de hoje. Amanhã o limite renova.`);
    }
    const publicadas = (preparo.extras[0] as LinhaLista[] | null) ?? [];
    const sistema = montarSistema(idioma, nivel, publicadas.map(paraImportacao));

    let resultado = await chamarModelo(config, sistema, mensagens, env, fetchFn);
    let resposta: RespostaAssistente;
    let tokensEntrada = resultado.tokensEntrada;
    let tokensSaida = resultado.tokensSaida;
    try {
      resposta = interpretarResposta(resultado.texto);
    } catch (erro) {
      // Sem tempo para outra chamada antes do corte do Supabase (150 s): melhor avisar que deixar o professor esperando.
      if (Date.now() - inicio > TEMPO_PARA_SEGUNDA_CHANCE_MS) throw erro;
      // Uma segunda chance, dizendo ao modelo o que estava errado.
      const correcao: Mensagem[] = [
        ...mensagens,
        { papel: "assistente", texto: resultado.texto.slice(0, 4000) },
        { papel: "professor", texto: `Sua resposta não seguiu o formato (${(erro as Error).message}). Responda de novo apenas com o objeto JSON {"mensagem", "lista"}.` },
      ];
      resultado = await chamarModelo(config, sistema, correcao, env, fetchFn);
      tokensEntrada += resultado.tokensEntrada;
      tokensSaida += resultado.tokensSaida;
      resposta = interpretarResposta(resultado.texto);
    }

    config = { ...config, modelo: resultado.modelo ?? config.modelo };
    await registrarGeracao(supabase, { habilidade: "gerar_lista", config, pedido: ultimaMensagem, ok: true, erro: "", inicio, tokensEntrada, tokensSaida });
    return json({ ...resposta, provedor: config.provedor, modelo: config.modelo, restantes: Math.max(config.limite_diario - usadas - 1, 0) });
  } catch (erro) {
    const status = erro instanceof ErroHttp ? erro.status : 500;
    const mensagem = (erro as Error).message;
    // Erros de login/permissão não entram no histórico (não há professor válido para registrar).
    if (status !== 401 && status !== 403) {
      await registrarGeracao(supabase, { habilidade: "gerar_lista", config, pedido: ultimaMensagem, ok: false, erro: mensagem, inicio }).catch(() => undefined);
    }
    const amigavel =
      status === 429 && !mensagem.startsWith("Você já usou")
        ? "O limite gratuito da IA foi atingido agora. Tente de novo em alguns minutos."
        : status >= 500 || (status >= 400 && mensagem.includes("respondeu"))
          ? "O assistente não conseguiu gerar a resposta agora. Tente de novo."
          : mensagem;
    return json({ erro: amigavel, detalhe: mensagem }, status);
  }
}

servir(atender);
