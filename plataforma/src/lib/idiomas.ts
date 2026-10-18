/** Idiomas e níveis. Sem dependências: usado pelo site e pelos scripts de teste. */

export type Idioma = "ingles" | "espanhol";

export const IDIOMAS: Record<Idioma, string> = {
  ingles: "Inglês",
  espanhol: "Espanhol",
};

/** Mesma escala nos dois idiomas; só os nomes mudam. O banco guarda o número (1 a 6). */
export const NIVEIS: Record<Idioma, string[]> = {
  ingles: ["Beginner", "Elementary", "Pre-Intermediate", "Intermediate", "Upper-Intermediate", "Advanced"],
  espanhol: ["Principiante", "Básico", "Pre-intermedio", "Intermedio", "Intermedio alto", "Avanzado"],
};

export function nomeNivel(idioma: Idioma, nivel: number) {
  return NIVEIS[idioma][nivel - 1] ?? `Nível ${nivel}`;
}
