/**
 * Vozes prontas do Gemini TTS (as mesmas aceitas pela Edge Function "audio").
 * O gênero é o da voz como soa; o estilo vem da descrição do Google, traduzida.
 */
export type Voz = { nome: string; genero: "feminina" | "masculina"; estilo: string };

export const VOZES: Voz[] = [
  { nome: "Kore", genero: "feminina", estilo: "firme" },
  { nome: "Leda", genero: "feminina", estilo: "jovem" },
  { nome: "Aoede", genero: "feminina", estilo: "leve" },
  { nome: "Despina", genero: "feminina", estilo: "suave" },
  { nome: "Erinome", genero: "feminina", estilo: "clara" },
  { nome: "Zephyr", genero: "feminina", estilo: "animada" },
  { nome: "Autonoe", genero: "feminina", estilo: "viva" },
  { nome: "Callirrhoe", genero: "feminina", estilo: "tranquila" },
  { nome: "Laomedeia", genero: "feminina", estilo: "alegre" },
  { nome: "Achernar", genero: "feminina", estilo: "macia" },
  { nome: "Gacrux", genero: "feminina", estilo: "madura" },
  { nome: "Pulcherrima", genero: "feminina", estilo: "direta" },
  { nome: "Vindemiatrix", genero: "feminina", estilo: "gentil" },
  { nome: "Sulafat", genero: "feminina", estilo: "acolhedora" },
  { nome: "Puck", genero: "masculina", estilo: "animado" },
  { nome: "Charon", genero: "masculina", estilo: "informativo" },
  { nome: "Orus", genero: "masculina", estilo: "firme" },
  { nome: "Iapetus", genero: "masculina", estilo: "claro" },
  { nome: "Achird", genero: "masculina", estilo: "simpático" },
  { nome: "Umbriel", genero: "masculina", estilo: "tranquilo" },
  { nome: "Algieba", genero: "masculina", estilo: "suave" },
  { nome: "Schedar", genero: "masculina", estilo: "equilibrado" },
  { nome: "Sadaltager", genero: "masculina", estilo: "experiente" },
  { nome: "Sadachbia", genero: "masculina", estilo: "vivo" },
  { nome: "Zubenelgenubi", genero: "masculina", estilo: "casual" },
  { nome: "Fenrir", genero: "masculina", estilo: "empolgado" },
  { nome: "Enceladus", genero: "masculina", estilo: "sussurrado" },
  { nome: "Algenib", genero: "masculina", estilo: "rouco" },
  { nome: "Rasalgethi", genero: "masculina", estilo: "informativo" },
  { nome: "Alnilam", genero: "masculina", estilo: "firme" },
];

/** Vozes usadas por padrão: as mais claras para quem está aprendendo. */
const PADRAO = { feminina: ["Kore", "Leda", "Erinome", "Despina"], masculina: ["Puck", "Charon", "Iapetus", "Achird"] };

export const MAX_FALANTES = 2;

/** Falantes na ordem em que aparecem num roteiro "NOME: fala" (linhas sem falante continuam a fala anterior). */
export function falantesDoRoteiro(roteiro: string): string[] {
  const falantes: string[] = [];
  for (const linha of roteiro.split(/\r?\n/)) {
    const encontrado = /^\s*([^:]{1,40}):\s*\S/.exec(linha);
    if (encontrado && !falantes.includes(encontrado[1].trim())) falantes.push(encontrado[1].trim());
  }
  return falantes;
}

/**
 * Completa a voz de quem ainda não tem: usa o gênero indicado (vindo do assistente) e, sem indicação,
 * alterna feminina/masculina para as vozes ficarem bem diferentes entre si.
 */
export function completarVozes(falantes: string[], vozes: Record<string, string>, generos: Record<string, string> = {}): Record<string, string> {
  const resultado: Record<string, string> = {};
  const usadas = new Set<string>();
  for (const f of falantes) {
    if (VOZES.some((v) => v.nome === vozes[f])) {
      resultado[f] = vozes[f];
      usadas.add(vozes[f]);
    }
  }
  falantes.forEach((f, i) => {
    if (resultado[f]) return;
    const pedido = generos[f]?.toLowerCase();
    const genero = pedido === "masculina" || pedido === "feminina" ? pedido : i % 2 === 0 ? "feminina" : "masculina";
    const voz = PADRAO[genero].find((n) => !usadas.has(n)) ?? PADRAO[genero][0];
    resultado[f] = voz;
    usadas.add(voz);
  });
  return resultado;
}
