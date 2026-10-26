// Voz do listening: ler o roteiro, pedir o áudio ao Gemini TTS e montar o WAV.

import { ErroHttp, esperaSugerida, esperar } from "../_shared/http.ts";

export type Fala = { falante: string; texto: string };

const SILENCIO_INICIAL_S = 0.6;
const FADE_S = 0.012;
const MAX_FALANTES = 2;

/** Vozes prontas do Gemini aceitas pela plataforma (a lista com gênero e estilo fica em plataforma/src/lib/vozes.ts). */
export const VOZES_GEMINI = new Set([
  "Zephyr", "Puck", "Charon", "Kore", "Fenrir", "Leda", "Orus", "Aoede", "Callirrhoe", "Autonoe",
  "Enceladus", "Iapetus", "Umbriel", "Algieba", "Despina", "Erinome", "Algenib", "Rasalgethi", "Laomedeia", "Achernar",
  "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Achird", "Zubenelgenubi", "Vindemiatrix", "Sadachbia", "Sadaltager", "Sulafat",
]);

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

export type AudioPcm = { pcm: Uint8Array; taxa: number; modelo: string };

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

export async function sintetizarTrecho(modelo: string, trecho: Fala[], vozes: Record<string, string>, chave: string, fetchFn: typeof fetch): Promise<AudioPcm> {
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
    await esperar(espera);
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
export function montarWav(audio: AudioPcm): { wav: Uint8Array<ArrayBuffer>; segundos: number } {
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
