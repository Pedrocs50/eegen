// Edge Function "audio": transforma o roteiro de um listening em áudio com o TTS do Gemini.
//
// Recebe {roteiro: "MIA: Hello.\nSAM: Hi!", vozes: {MIA: "Kore", SAM: "Puck"}} e devolve audio/wav (PCM 24 kHz mono).
// O navegador converte para MP3 e envia ao Storage (bucket "audios"): assim esta função gasta pouco processamento.
//
// Cada áudio tem no máximo 2 falantes (limite do modo de diálogo do Gemini e da cota grátis: 3 pedidos/minuto).
//
// Segredo: GEMINI_API_KEY (o mesmo do assistente).
// Publicação: automática pelo GitHub Actions a cada push (.github/workflows/funcoes.yml).

import { clienteSupabase, CORS, ErroHttp, json, prepararGeracao, registrarGeracao, servir, tokenDoPedido, type Config, type LerAmbiente } from "../_shared/http.ts";
import { conferirFalantes, lerRoteiro, montarWav, sintetizarTrecho, VOZES_GEMINI, type AudioPcm } from "./voz.ts";

const CONFIG_PADRAO: Config = { provedor: "gemini", modelo: "gemini-3.8-flash-tts", limite_diario: 10 };
/**
 * Modelo de reserva quando a cota diária do principal acaba. No plano grátis (teste de 18/10/2026) cada modelo
 * de voz aceita 10 pedidos por dia por projeto e 3 por minuto; o "lite" tem cota própria, então dobra o total.
 */
const MODELO_RESERVA = "gemini-3.8-flash-lite-tts";
const MAX_FALAS = 80;
const MAX_CARACTERES = 6000;

export async function atender(req: Request, env: LerAmbiente, fetchFn: typeof fetch = fetch): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);

  const token = tokenDoPedido(req);
  if (!token) return json({ erro: "Faça login para gerar áudio." }, 401);

  const inicio = Date.now();
  let config = CONFIG_PADRAO;
  let resumo = "";
  const supabase = clienteSupabase(env, token, fetchFn);

  try {
    const corpo = await req.json().catch(() => ({}));
    const roteiro = String(corpo.roteiro ?? "");
    const vozes: Record<string, string> = corpo.vozes && typeof corpo.vozes === "object" ? corpo.vozes : {};
    if (roteiro.length > MAX_CARACTERES) throw new ErroHttp(400, `O roteiro está muito longo (${roteiro.length} caracteres; máximo ${MAX_CARACTERES}).`);
    const falas = lerRoteiro(roteiro);
    if (falas.length > MAX_FALAS) throw new ErroHttp(400, `O roteiro tem ${falas.length} falas; o máximo é ${MAX_FALAS}.`);
    for (const falante of conferirFalantes(falas)) {
      if (!VOZES_GEMINI.has(vozes[falante])) throw new ErroHttp(400, `Escolha uma voz para ${falante}.`);
    }
    resumo = roteiro.slice(0, 300);

    const preparo = await prepararGeracao(supabase, "gerar_audio", CONFIG_PADRAO, "Só professores e admins geram áudio.");
    config = preparo.config;
    const { usadas } = preparo;
    if (usadas >= config.limite_diario) throw new ErroHttp(429, `Você já gerou os ${config.limite_diario} áudios de hoje. Amanhã o limite renova.`);

    const chave = env("GEMINI_API_KEY");
    if (!chave) throw new ErroHttp(500, "A chave GEMINI_API_KEY não está configurada nos segredos das Edge Functions.");

    let audio: AudioPcm;
    try {
      audio = await sintetizarTrecho(config.modelo, falas, vozes, chave, fetchFn);
    } catch (erro) {
      if (!(erro as Error).message.startsWith("COTA_DO_DIA") || config.modelo === MODELO_RESERVA) throw erro;
      audio = await sintetizarTrecho(MODELO_RESERVA, falas, vozes, chave, fetchFn);
    }
    config = { ...config, modelo: audio.modelo };
    const { wav, segundos } = montarWav(audio);

    await registrarGeracao(supabase, { habilidade: "gerar_audio", config, pedido: resumo, ok: true, erro: "", inicio });
    return new Response(wav, {
      headers: { ...CORS, "Content-Type": "application/octet-stream", "x-duracao": segundos.toFixed(1), "x-modelo": audio.modelo, "x-restantes": String(Math.max(config.limite_diario - usadas - 1, 0)) },
    });
  } catch (erro) {
    const status = erro instanceof ErroHttp ? erro.status : 500;
    const mensagem = (erro as Error).message;
    if (status !== 401 && status !== 403) {
      await registrarGeracao(supabase, { habilidade: "gerar_audio", config, pedido: resumo, ok: false, erro: mensagem, inicio }).catch(() => undefined);
    }
    const amigavel =
      status === 429 && !mensagem.startsWith("Você já gerou")
        ? mensagem.startsWith("COTA_DO_DIA")
          ? "Os áudios grátis de hoje acabaram (o Google libera cerca de 20 por dia para a escola). Amanhã renova; listas já geradas continuam funcionando."
          : "O limite gratuito de áudio do Gemini foi atingido agora. Tente de novo em um minuto."
        : mensagem.includes("respondeu") || status >= 500
          ? "Não foi possível gerar o áudio agora. Tente de novo."
          : mensagem;
    return json({ erro: amigavel, detalhe: mensagem }, status);
  }
}

servir(atender);
