// Edge Function "audio": transforma o roteiro de um listening em áudio com o TTS do Gemini.
//
// Recebe {roteiro: "MIA: Hello.\nSAM: Hi!", vozes: {MIA: "Kore", SAM: "Puck"}} e devolve audio/wav (PCM 24 kHz mono).
// O navegador converte para MP3 e envia ao Storage (bucket "audios"): assim esta função gasta pouco processamento.
//
// Cada áudio tem no máximo 2 falantes (limite do modo de diálogo do Gemini e da cota grátis: 3 pedidos/minuto).
//
// Segredo: GEMINI_API_KEY (o mesmo do assistente). Arquivo único e sem dependências, como o "assistente",
// para poder ser publicado colando no painel do Supabase; por isso alguns trechos se repetem entre os dois.

type Fala = { falante: string; texto: string };
type Config = { provedor: string; modelo: string; limite_diario: number };
type LerAmbiente = (nome: string) => string | undefined;

const CONFIG_PADRAO: Config = { provedor: "gemini", modelo: "gemini-3.8-flash-tts", limite_diario: 10 };
/**
 * Modelo de reserva quando a cota diária do principal acaba. No plano grátis (teste de 18/10/2026) cada modelo
 * de voz aceita 10 pedidos por dia por projeto e 3 por minuto; o "lite" tem cota própria, então dobra o total.
 */
const MODELO_RESERVA = "gemini-3.8-flash-lite-tts";
const MAX_FALAS = 80;
const MAX_CARACTERES = 6000;
const SILENCIO_INICIAL_S = 0.6;
const FADE_S = 0.012;
const MAX_FALANTES = 2;

/** Vozes prontas do Gemini aceitas pela plataforma (a lista com gênero e estilo fica em plataforma/src/lib/vozes.ts). */
export const VOZES_GEMINI = new Set([
  "Zephyr", "Puck", "Charon", "Kore", "Fenrir", "Leda", "Orus", "Aoede", "Callirrhoe", "Autonoe",
  "Enceladus", "Iapetus", "Umbriel", "Algieba", "Despina", "Erinome", "Algenib", "Rasalgethi", "Laomedeia", "Achernar",
  "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Achird", "Zubenelgenubi", "Vindemiatrix", "Sadachbia", "Sadaltager", "Sulafat",
]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "x-duracao, x-restantes, x-modelo",
};

class ErroHttp extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Roteiro
// ---------------------------------------------------------------------------

/** Lê "FALANTE: texto" por linha; linhas sem falante continuam a fala anterior (como no gerador.py). */
export function lerRoteiro(roteiro: string): Fala[] {
  const falas: Fala[] = [];
  for (const linhaBruta of roteiro.split(/\r?\n/)) {
    const linha = linhaBruta.trim();
    if (!linha) continue;
    const encontrado = /^([^:]{1,40}):\s*(.+)$/.exec(linha);
    if (encontrado) falas.push({ falante: encontrado[1].trim(), texto: encontrado[2].trim() });
    else if (falas.length) falas[falas.length - 1].texto += ` ${linha}`;
    else throw new ErroHttp(400, `A primeira linha do roteiro precisa ter o falante: "NOME: fala". Veio: "${linha.slice(0, 60)}"`);
  }
  if (falas.length === 0) throw new ErroHttp(400, "O roteiro está vazio. Escreva uma fala por linha: \"NOME: fala\".");
  return falas;
}

/**
 * Cada áudio tem no máximo 2 falantes e vira UM pedido ao Gemini.
 * Motivos (testes de 18/10/2026): o plano grátis aceita só 3 pedidos de voz por minuto, e dividir
 * diálogos maiores em vários pedidos fez o modelo trocar a voz de um falante entre um trecho e outro.
 */
export function conferirFalantes(falas: Fala[]): string[] {
  const falantes = [...new Set(falas.map((f) => f.falante))];
  if (falantes.length > MAX_FALANTES) {
    throw new ErroHttp(400, `Este roteiro tem ${falantes.length} falantes (${falantes.join(", ")}). Cada áudio aceita no máximo ${MAX_FALANTES}: divida a conversa em dois áudios.`);
  }
  return falantes;
}

// ---------------------------------------------------------------------------
// Gemini TTS
// ---------------------------------------------------------------------------

type AudioPcm = { pcm: Uint8Array; taxa: number; modelo: string };

/**
 * Monta o pedido conforme o modelo: os modelos 3.x marcam o falante em cada parte (speechMetadata);
 * o 2.5 recebe o diálogo como texto "NOME: fala".
 */
function corpoDoPedido(modelo: string, trecho: Fala[], vozes: Record<string, string>) {
  const falantes = [...new Set(trecho.map((f) => f.falante))];
  const legado = modelo.includes("2.5");
  const speechConfig =
    falantes.length === 1
      ? { voiceConfig: { prebuiltVoiceConfig: { voiceName: vozes[falantes[0]] } } }
      : { multiSpeakerVoiceConfig: { speakerVoiceConfigs: falantes.map((speaker) => ({ speaker, voiceConfig: { prebuiltVoiceConfig: { voiceName: vozes[speaker] } } })) } };
  const parts =
    falantes.length === 1
      ? [{ text: trecho.map((f) => f.texto).join("\n") }]
      : legado
        ? [{ text: trecho.map((f) => `${f.falante}: ${f.texto}`).join("\n") }]
        : trecho.map((f) => ({ text: f.texto, speechMetadata: { speaker: f.falante } }));
  return { contents: [{ role: "user", parts }], generationConfig: { responseModalities: ["AUDIO"], speechConfig } };
}

function base64ParaBytes(base64: string): Uint8Array {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/** Segundos que o Google pede para esperar antes de tentar de novo (detalhe RetryInfo do erro 429). */
function esperaSugerida(dados: { error?: { details?: { retryDelay?: string }[] } }): number | undefined {
  const atraso = dados.error?.details?.find((d) => d.retryDelay)?.retryDelay;
  const segundos = atraso ? parseFloat(atraso) : NaN;
  return Number.isFinite(segundos) ? Math.ceil(segundos) + 1 : undefined;
}

async function sintetizarTrecho(modelo: string, trecho: Fala[], vozes: Record<string, string>, chave: string, fetchFn: typeof fetch): Promise<AudioPcm> {
  for (let tentativa = 0; ; tentativa++) {
    const resposta = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
      body: JSON.stringify(corpoDoPedido(modelo, trecho, vozes)),
    });
    const dados = await resposta.json().catch(() => ({}));
    if (resposta.ok) {
      const parte = (dados.candidates?.[0]?.content?.parts ?? []).find((p: { inlineData?: unknown }) => p.inlineData);
      if (!parte) throw new ErroHttp(502, `O Gemini não devolveu áudio: ${JSON.stringify(dados).slice(0, 200)}`);
      const taxa = Number(/rate=(\d+)/.exec(parte.inlineData.mimeType ?? "")?.[1] ?? 24000);
      return { pcm: base64ParaBytes(parte.inlineData.data), taxa, modelo };
    }
    const espera = esperaSugerida(dados) ?? 2 * 2 ** tentativa;
    const temporario = (resposta.status === 429 || resposta.status === 503) && espera <= 20;
    if (!temporario || tentativa >= 1) {
      const cotaDoDia = resposta.status === 429 && espera > 20;
      throw new ErroHttp(resposta.status, `${cotaDoDia ? "COTA_DO_DIA " : ""}Gemini TTS (${modelo}) respondeu ${resposta.status}: ${JSON.stringify(dados).slice(0, 300)}`);
    }
    await new Promise((r) => setTimeout(r, espera * 1000));
  }
}

/** Fade-in e fade-out de poucos milissegundos: tira o estalo que aparece quando trechos são emendados. */
function suavizarPontas(pcm: Uint8Array, taxa: number): Uint8Array {
  const copia = new Uint8Array(pcm);
  const amostras = new DataView(copia.buffer);
  const total = Math.floor(copia.length / 2);
  const n = Math.min(Math.round(FADE_S * taxa), Math.floor(total / 2));
  for (let i = 0; i < n; i++) {
    const ganho = i / n;
    amostras.setInt16(i * 2, Math.round(amostras.getInt16(i * 2, true) * ganho), true);
    const j = total - 1 - i;
    amostras.setInt16(j * 2, Math.round(amostras.getInt16(j * 2, true) * ganho), true);
  }
  return copia;
}

/** Acrescenta um respiro no início e o cabeçalho WAV (PCM 16 bits mono). */
export function montarWav(audio: AudioPcm): { wav: Uint8Array; segundos: number } {
  const { taxa } = audio;
  const silencio = new Uint8Array(Math.round(SILENCIO_INICIAL_S * taxa) * 2);
  const corpo = suavizarPontas(audio.pcm, taxa);
  const tamanho = silencio.length + corpo.length;
  const wav = new Uint8Array(44 + tamanho);
  const v = new DataView(wav.buffer);
  const texto = (pos: number, t: string) => [...t].forEach((c, i) => v.setUint8(pos + i, c.charCodeAt(0)));
  texto(0, "RIFF"); v.setUint32(4, 36 + tamanho, true); texto(8, "WAVE"); texto(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, taxa, true);
  v.setUint32(28, taxa * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); texto(36, "data"); v.setUint32(40, tamanho, true);
  wav.set(silencio, 44);
  wav.set(corpo, 44 + silencio.length);
  return { wav, segundos: tamanho / 2 / taxa };
}

// ---------------------------------------------------------------------------
// Supabase (REST com o login do próprio professor)
// ---------------------------------------------------------------------------

function clienteSupabase(env: LerAmbiente, token: string, fetchFn: typeof fetch) {
  const url = env("SUPABASE_URL");
  const anon = env("SUPABASE_ANON_KEY");
  if (!url || !anon) throw new ErroHttp(500, "SUPABASE_URL ou SUPABASE_ANON_KEY ausentes no ambiente da função.");
  return async (caminho: string, init: RequestInit = {}) => {
    const resposta = await fetchFn(`${url}${caminho}`, {
      ...init,
      headers: { apikey: anon, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    const corpo = await resposta.text();
    if (!resposta.ok) throw new ErroHttp(resposta.status, `Supabase ${caminho.split("?")[0]} respondeu ${resposta.status}: ${corpo.slice(0, 200)}`);
    return corpo ? JSON.parse(corpo) : null;
  };
}

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// ---------------------------------------------------------------------------
// Atendimento
// ---------------------------------------------------------------------------

export async function atender(req: Request, env: LerAmbiente, fetchFn: typeof fetch = fetch): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ erro: "Faça login para gerar áudio." }, 401);

  const inicio = Date.now();
  let config = CONFIG_PADRAO;
  let resumo = "";
  const supabase = clienteSupabase(env, token, fetchFn);

  try {
    await supabase("/auth/v1/user").catch(() => {
      throw new ErroHttp(401, "Sua sessão expirou. Entre de novo.");
    });
    if ((await supabase("/rest/v1/rpc/eh_equipe", { method: "POST", body: "{}" })) !== true) {
      throw new ErroHttp(403, "Só professores e admins geram áudio.");
    }

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

    const [linhaConfig] = (await supabase("/rest/v1/config_ia?habilidade=eq.gerar_audio&select=provedor,modelo,limite_diario")) ?? [];
    config = linhaConfig ?? CONFIG_PADRAO;
    const usadas: number = await supabase("/rest/v1/rpc/geracoes_hoje", { method: "POST", body: JSON.stringify({ habilidade_pedida: "gerar_audio" }) });
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

    await registrar(supabase, config, resumo, true, "", inicio);
    return new Response(wav, {
      headers: { ...CORS, "Content-Type": "application/octet-stream", "x-duracao": segundos.toFixed(1), "x-modelo": audio.modelo, "x-restantes": String(Math.max(config.limite_diario - usadas - 1, 0)) },
    });
  } catch (erro) {
    const status = erro instanceof ErroHttp ? erro.status : 500;
    const mensagem = (erro as Error).message;
    if (status !== 401 && status !== 403) await registrar(supabase, config, resumo, false, mensagem, inicio).catch(() => undefined);
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

async function registrar(supabase: ReturnType<typeof clienteSupabase>, config: Config, pedido: string, ok: boolean, erro: string, inicio: number) {
  await supabase("/rest/v1/geracoes_ia", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      habilidade: "gerar_audio", provedor: config.provedor, modelo: config.modelo, pedido, ok, erro: erro.slice(0, 1000),
      segundos: Math.round((Date.now() - inicio) / 100) / 10,
    }),
  });
}

// No Supabase (Deno), publica o servidor. Nos testes (Node), só exporta as funções.
type AmbienteDeno = { serve: (h: (req: Request) => Promise<Response>) => void; env: { get: (n: string) => string | undefined } };
const deno = (globalThis as { Deno?: AmbienteDeno }).Deno;
if (deno) {
  deno.serve((req) => atender(req, (nome) => deno.env.get(nome)));
}
