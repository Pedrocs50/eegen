import { supabase } from "./supabase";
import type { Papel } from "./supabase";
import type { Idioma } from "./idiomas";

/** Link que a professora manda no grupo: abre o cadastro (ou a entrada na turma) com o código preenchido. */
export function linkDeConvite(codigo: string) {
  return `${window.location.origin}/convite/${codigo}`;
}

/** Mensagem de convite para o grupo da turma: o link (que já leva o código) e o código, para quem preferir digitar. */
export function mensagemDeConvite(nomeTurma: string, codigo: string) {
  return [
    `Olá, turma ${nomeTurma}! 👋`,
    "",
    "As aulas e os exercícios agora ficam na plataforma da UP English.",
    "",
    `👉 Entre por este link: ${linkDeConvite(codigo)}`,
    "",
    "1. Crie sua conta (ou entre, se já tiver uma).",
    `2. Confira se aparece a turma "${nomeTurma}" e envie o pedido.`,
    "3. Assim que eu aprovar, você já vê as aulas e os exercícios.",
    "",
    `Se pedirem o código da turma, é: ${codigo}`,
    "",
    "Qualquer dúvida, é só me chamar! 😊",
  ].join("\n");
}

/** Aviso de aula liberada, com o link direto para a aula. */
export function mensagemDeAula(aula: { id: string; numero: number; titulo: string; subtitulo?: string }) {
  return [
    `📚 Aula ${aula.numero} liberada: ${aula.titulo}`,
    ...(aula.subtitulo ? [aula.subtitulo] : []),
    "",
    "O material e os exercícios já estão na plataforma:",
    `👉 ${window.location.origin}/aulas/${aula.id}`,
    "",
    "Bons estudos! 💪",
  ].join("\n");
}

/** Aviso dos exercícios extras da turma, um link para cada. */
export function mensagemDeExtras(listas: { id: string; titulo: string }[]) {
  return [
    listas.length === 1 ? "✨ Exercício extra para praticar:" : "✨ Exercícios extras para praticar:",
    "",
    ...listas.map((l) => `• ${l.titulo}: ${window.location.origin}/praticar/${l.id}`),
    "",
    "Pode refazer quantas vezes quiser: vale a sua melhor nota!",
  ].join("\n");
}

export type SituacaoMatricula = "pendente" | "aprovada";
export type CursoResumo = { id: string; titulo: string; idioma: Idioma; nivel: number };

/** Uma turma do ponto de vista do aluno (ou da equipe, na "visão do aluno"). */
export type TurmaDoAluno = {
  id: string;
  nome: string;
  situacao: SituacaoMatricula;
  curso: CursoResumo | null;
  professor: string | null;
};

type LinhaTurma = { id: string; nome: string; cursos: CursoResumo | null; professor: { nome: string } | null };
const CAMPOS_TURMA = "id, nome, cursos(id, titulo, idioma, nivel), professor:perfis!professor_id(nome)";

/**
 * Turmas do aluno logado, com a situação da matrícula. Para a equipe, as turmas que ela gerencia,
 * como se estivesse matriculada (é a "visão do aluno").
 */
export async function buscarTurmasDoAluno(idPessoa: string, papel: Papel) {
  if (papel !== "aluno") {
    const { data, error } = await supabase.from("turmas").select(CAMPOS_TURMA).order("criado_em", { ascending: false });
    if (error) return { data: null, error };
    const turmas = (data as unknown as LinhaTurma[]).map((t) => ({ id: t.id, nome: t.nome, situacao: "aprovada" as const, curso: t.cursos, professor: t.professor?.nome ?? null }));
    return { data: turmas, error: null };
  }
  const { data, error } = await supabase
    .from("matriculas")
    .select(`situacao, criado_em, turmas(${CAMPOS_TURMA})`)
    .eq("aluno_id", idPessoa)
    .order("criado_em", { ascending: false });
  if (error) return { data: null, error };
  const turmas = (data as unknown as { situacao: SituacaoMatricula; turmas: LinhaTurma | null }[])
    .filter((m) => m.turmas)
    .map((m) => ({ id: m.turmas!.id, nome: m.turmas!.nome, situacao: m.situacao, curso: m.turmas!.cursos, professor: m.turmas!.professor?.nome ?? null }));
  return { data: turmas, error: null };
}

// ---------------------------------------------------------------------------
// Conteúdo de uma turma: aulas liberadas (com os exercícios de cada uma) e exercícios avulsos
// ---------------------------------------------------------------------------

export type ListaDaTurma = {
  id: string;
  titulo: string;
  descricao: string;
  status: "rascunho" | "publicada";
  questoes: { count: number }[];
  secoes: { tipo_estimulo: string }[];
};
export type AulaDaTurma = {
  id: string;
  numero: number;
  titulo: string;
  subtitulo: string;
  temMaterial: boolean;
  liberadaEm: string;
  listas: ListaDaTurma[];
};
export type ConteudoDaTurma = {
  aulas: AulaDaTurma[];
  extras: (ListaDaTurma & { liberadaEm: string })[];
  /** Melhor nota de cada lista (só das que a pessoa já fez). */
  notas: Record<string, number>;
};

const CAMPOS_LISTA = "id, titulo, descricao, status, questoes(count), secoes(tipo_estimulo)";
type LinhaAula = {
  id: string; numero: number; titulo: string; subtitulo: string; material_arquivo: string; material_url: string;
  aula_listas: { ordem: number; listas: ListaDaTurma | null }[];
};
type LinhaConteudo = {
  cursos: { aulas: LinhaAula[] } | null;
  aulas_liberadas: { aula_id: string; liberada_em: string }[];
  turma_listas: { ordem: number; liberada_em: string; listas: ListaDaTurma | null }[];
};

/** Só o que o aluno vê: aulas liberadas e listas publicadas (a equipe também recebe rascunhos e aulas bloqueadas, que ficam de fora). */
export async function buscarConteudoDaTurma(idTurma: string, idPessoa: string) {
  const { data, error } = await supabase
    .from("turmas")
    .select(`cursos(aulas(id, numero, titulo, subtitulo, material_arquivo, material_url, aula_listas(ordem, listas(${CAMPOS_LISTA})))), aulas_liberadas(aula_id, liberada_em), turma_listas(ordem, liberada_em, listas(${CAMPOS_LISTA}))`)
    .eq("id", idTurma)
    .single();
  if (error) return { data: null, error };
  const linha = data as unknown as LinhaConteudo;
  const liberadas = new Map(linha.aulas_liberadas.map((l) => [l.aula_id, l.liberada_em]));
  const publicada = (l: ListaDaTurma | null): l is ListaDaTurma => !!l && l.status === "publicada";

  const aulas = (linha.cursos?.aulas ?? [])
    .filter((a) => liberadas.has(a.id))
    .sort((a, b) => a.numero - b.numero)
    .map((a) => ({
      id: a.id,
      numero: a.numero,
      titulo: a.titulo,
      subtitulo: a.subtitulo,
      temMaterial: !!(a.material_arquivo || a.material_url),
      liberadaEm: liberadas.get(a.id)!,
      listas: [...a.aula_listas].sort((x, y) => x.ordem - y.ordem).map((x) => x.listas).filter(publicada),
    }));
  const extras = [...linha.turma_listas]
    .sort((a, b) => a.ordem - b.ordem || b.liberada_em.localeCompare(a.liberada_em))
    .filter((x) => publicada(x.listas))
    .map((x) => ({ ...x.listas!, liberadaEm: x.liberada_em }));

  const ids = [...new Set([...aulas.flatMap((a) => a.listas.map((l) => l.id)), ...extras.map((l) => l.id)])];
  const notas: Record<string, number> = {};
  if (ids.length) {
    const { data: tentativas } = await supabase.from("tentativas").select("lista_id, nota").eq("aluno_id", idPessoa).in("lista_id", ids);
    for (const t of tentativas ?? []) notas[t.lista_id] = Math.max(notas[t.lista_id] ?? 0, Number(t.nota));
  }
  return { data: { aulas, extras, notas } satisfies ConteudoDaTurma, error: null };
}

/** Turma escolhida: a da URL, senão a última aberta, senão a primeira aprovada. */
const CHAVE_TURMA = "up:turma";
export function lembrarTurma(id: string) {
  try {
    localStorage.setItem(CHAVE_TURMA, id);
  } catch {
    /* navegação privada: só não lembra */
  }
}
export function escolherTurma(turmas: TurmaDoAluno[], daUrl: string | null) {
  const aprovadas = turmas.filter((t) => t.situacao === "aprovada");
  let lembrada: string | null = null;
  try {
    lembrada = localStorage.getItem(CHAVE_TURMA);
  } catch {
    lembrada = null;
  }
  return aprovadas.find((t) => t.id === daUrl) ?? aprovadas.find((t) => t.id === lembrada) ?? aprovadas[0] ?? null;
}

export const DIAS_NOVIDADE = 7;
export const ehNova = (data: string) => Date.now() - new Date(data).getTime() < DIAS_NOVIDADE * 864e5;
