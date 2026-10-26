// Entrada e saída do modelo: ler a resposta (tolerando o JSON torto dos modelos grátis) e converter listas do
// banco para o formato de importação, que é o mesmo que pedimos ao modelo.

export type RespostaAssistente = { mensagem: string; lista: Record<string, unknown> | null };

/** Lê o JSON do modelo tolerando bloco ```json, texto em volta e vírgula sobrando; confere o formato básico. */
export function interpretarResposta(texto: string): RespostaAssistente {
  let limpo = texto.trim();
  const bloco = limpo.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (bloco) limpo = bloco[1].trim();
  const inicio = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  if (inicio === -1 || fim <= inicio) throw new Error(`não veio um objeto JSON. Início da resposta: "${texto.slice(0, 120)}"`);
  limpo = limpo.slice(inicio, fim + 1);
  let objeto: Record<string, unknown>;
  try {
    objeto = JSON.parse(limpo);
  } catch {
    objeto = JSON.parse(limpo.replace(/,\s*([}\]])/g, "$1"));
  }
  // Alguns modelos devolvem a lista direto, sem o envelope {mensagem, lista}.
  if (Array.isArray(objeto.secoes)) return { mensagem: "Lista criada.", lista: objeto };
  const lista = objeto.lista ?? null;
  if (lista !== null && (typeof lista !== "object" || !Array.isArray((lista as Record<string, unknown>).secoes))) {
    throw new Error('o campo "lista" não tem "secoes"');
  }
  return { mensagem: String(objeto.mensagem ?? ""), lista: lista as Record<string, unknown> | null };
}

// ---------------------------------------------------------------------------
// Listas publicadas da escola como exemplo
// ---------------------------------------------------------------------------

/** Campos das listas publicadas que vão de exemplo para o modelo (consulta REST). */
export const CAMPOS_PUBLICADAS =
  "titulo,tema,descricao,idioma,nivel,secoes(titulo,instrucao,tipo_estimulo,estimulo,ordem,questoes(formato,habilidade,enunciado,conteudo,ordem,gabaritos(gabarito,explicacao)))";

type LinhaQuestao = { formato: string; habilidade: string; enunciado: string; conteudo: Record<string, unknown>; ordem: number; gabaritos: { gabarito: Record<string, unknown>; explicacao: string } | { gabarito: Record<string, unknown>; explicacao: string }[] | null };
type LinhaSecao = { titulo: string; instrucao: string; tipo_estimulo: string; estimulo: { texto?: string; roteiro?: string; generos?: Record<string, string> }; ordem: number; questoes: LinhaQuestao[] };
export type LinhaLista = { titulo: string; tema: string; descricao: string; idioma: string; nivel: number; secoes: LinhaSecao[] };

/** Converte uma lista do banco para o formato de importação (o mesmo que pedimos ao modelo). */
export function paraImportacao(l: LinhaLista) {
  return {
    titulo: l.titulo, tema: l.tema, descricao: l.descricao, idioma: l.idioma, nivel: l.nivel,
    secoes: [...l.secoes].sort((a, b) => a.ordem - b.ordem).map((s) => ({
      tipo: s.tipo_estimulo === "nenhum" ? "questoes" : s.tipo_estimulo,
      titulo: s.titulo,
      instrucao: s.instrucao || undefined,
      texto: s.estimulo?.texto || undefined,
      roteiro: s.estimulo?.roteiro || undefined,
      vozes: s.estimulo?.generos && Object.keys(s.estimulo.generos).length ? s.estimulo.generos : undefined,
      questoes: [...s.questoes].sort((a, b) => a.ordem - b.ordem).slice(0, 6).map((q) => {
        const g = Array.isArray(q.gabaritos) ? q.gabaritos[0] : q.gabaritos;
        const gab = g?.gabarito ?? {};
        const base = { formato: q.formato, habilidade: q.habilidade, enunciado: q.enunciado, explicacao: g?.explicacao ?? "" };
        switch (q.formato) {
          case "multipla_escolha": return { ...base, opcoes: q.conteudo.opcoes, correta: gab.correta };
          case "verdadeiro_falso": return { ...base, resposta: gab.valor };
          case "lacuna_opcoes": return { ...base, opcoes: q.conteudo.opcoes, corretas: gab.lacunas };
          case "resposta_curta": return { ...base, aceitas: gab.aceitas };
          default: return { ...base, respostas: gab.lacunas, banco: q.conteudo.banco };
        }
      }),
    })),
  };
}
