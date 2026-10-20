import { supabase } from "./supabase";
import type { Idioma } from "./idiomas";
import type { Formato, Habilidade } from "./exercicios";

/** O que as funções resultados_equipe e resultados_lista (migração 0010) devolvem. */
export type Tentativa = { lista: string; aluno: string; nota: number; em: string };
export type AcertoHabilidade = { lista: string; aluno: string; habilidade: Habilidade; acertos: number; total: number };
export type Pessoa = { id: string; nome: string; email: string; papel: string };
export type ResultadosEquipe = { tentativas: Tentativa[]; habilidades: AcertoHabilidade[]; alunos: Pessoa[] };

export type QuestaoResultado = {
  id: string;
  secao: string;
  enunciado: string;
  formato: Formato;
  habilidade: Habilidade;
  conteudo: Record<string, unknown>;
  gabarito: Record<string, unknown>;
  respostas: number;
  /** Média da fração acertada (0 a 1); null quando ninguém respondeu. */
  acerto: number | null;
  erradas: { resposta: Record<string, unknown>; vezes: number }[];
};
export type ResultadosLista = { questoes: QuestaoResultado[]; tentativas: Omit<Tentativa, "lista">[]; alunos: Pessoa[] };

export type ListaResumo = { id: string; titulo: string; idioma: Idioma; nivel: number; status: "rascunho" | "publicada" };
export type TurmaResumo = { id: string; nome: string; matriculas: { aluno_id: string; situacao: string }[] };

export const PERIODOS = { "7": "7 dias", "30": "30 dias", "90": "90 dias", tudo: "Tudo" } as const;
export type Periodo = keyof typeof PERIODOS;

function desde(periodo: Periodo): string | null {
  if (periodo === "tudo") return null;
  const data = new Date();
  data.setHours(0, 0, 0, 0);
  data.setDate(data.getDate() - Number(periodo) + 1);
  return data.toISOString();
}

export async function buscarResultados(periodo: Periodo, incluirEquipe: boolean) {
  const [resultados, listas, turmas] = await Promise.all([
    supabase.rpc("resultados_equipe", { desde: desde(periodo), incluir_equipe: incluirEquipe }),
    supabase.from("listas").select("id, titulo, idioma, nivel, status"),
    supabase.from("turmas").select("id, nome, matriculas(aluno_id, situacao)").order("nome"),
  ]);
  if (resultados.error) return { data: null, error: resultados.error };
  if (listas.error) return { data: null, error: listas.error };
  if (turmas.error) return { data: null, error: turmas.error };
  const r = resultados.data as ResultadosEquipe;
  const dados = {
    tentativas: r.tentativas.map((t) => ({ ...t, nota: Number(t.nota) })),
    habilidades: r.habilidades.map((h) => ({ ...h, acertos: Number(h.acertos), total: Number(h.total) })),
    alunos: r.alunos,
    listas: listas.data as ListaResumo[],
    turmas: turmas.data as TurmaResumo[],
  };
  return { data: dados, error: null };
}
export type DadosResultados = NonNullable<Awaited<ReturnType<typeof buscarResultados>>["data"]>;

export async function buscarResultadosDaLista(id: string, incluirEquipe: boolean) {
  const [resultados, lista] = await Promise.all([
    supabase.rpc("resultados_lista", { id_lista: id, incluir_equipe: incluirEquipe }),
    supabase.from("listas").select("id, titulo, idioma, nivel, status").eq("id", id).single(),
  ]);
  if (resultados.error) return { data: null, error: resultados.error };
  if (lista.error) return { data: null, error: lista.error };
  const r = resultados.data as ResultadosLista;
  return {
    data: {
      lista: lista.data as ListaResumo,
      alunos: r.alunos,
      tentativas: r.tentativas.map((t) => ({ ...t, nota: Number(t.nota) })),
      questoes: r.questoes.map((q) => ({ ...q, respostas: Number(q.respostas), acerto: q.acerto === null ? null : Number(q.acerto) })),
    },
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Contas
// ---------------------------------------------------------------------------

export const media = (valores: number[]) => (valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null);

/** Vale a melhor nota de cada aluno em cada lista (é o que o aluno vê como "sua nota"). */
export function melhoresNotas(tentativas: Pick<Tentativa, "lista" | "aluno" | "nota">[]) {
  const melhores = new Map<string, { lista: string; aluno: string; nota: number }>();
  for (const t of tentativas) {
    const chave = `${t.aluno}|${t.lista}`;
    const atual = melhores.get(chave);
    if (!atual || t.nota > atual.nota) melhores.set(chave, { lista: t.lista, aluno: t.aluno, nota: t.nota });
  }
  return [...melhores.values()];
}

/** Primeira tentativa de cada aluno numa lista: mostra o que ele sabia antes de ver a correção. */
export function primeirasNotas(tentativas: Tentativa[]) {
  const primeiras = new Map<string, Tentativa>();
  for (const t of [...tentativas].sort((a, b) => a.em.localeCompare(b.em))) {
    if (!primeiras.has(`${t.aluno}|${t.lista}`)) primeiras.set(`${t.aluno}|${t.lista}`, t);
  }
  return [...primeiras.values()];
}

export const FAIXAS_NOTA = [
  { rotulo: "0–39", min: 0, max: 39 },
  { rotulo: "40–59", min: 40, max: 59 },
  { rotulo: "60–79", min: 60, max: 79 },
  { rotulo: "80–89", min: 80, max: 89 },
  { rotulo: "90–100", min: 90, max: 100 },
];

export function distribuicao(notas: number[]) {
  return FAIXAS_NOTA.map((f) => ({ ...f, quantidade: notas.filter((n) => n >= f.min && n <= f.max).length }));
}

/** Tentativas por dia (até 31 dias) ou por semana (períodos maiores). */
export function atividade(tentativas: Tentativa[], periodo: Periodo) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const primeira = tentativas.length ? new Date(tentativas[0].em) : hoje;
  const dias = periodo === "tudo" ? Math.max(7, Math.ceil((hoje.getTime() - primeira.getTime()) / 864e5) + 1) : Number(periodo);
  const porSemana = dias > 31;
  const passo = porSemana ? 7 : 1;
  const baldes = Math.ceil(dias / passo);
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - baldes * passo + 1);
  const contagem = Array.from({ length: baldes }, (_, i) => {
    const de = new Date(inicio);
    de.setDate(de.getDate() + i * passo);
    return { de, quantidade: 0 };
  });
  for (const t of tentativas) {
    const i = Math.floor((new Date(t.em).getTime() - inicio.getTime()) / (864e5 * passo));
    if (i >= 0 && i < baldes) contagem[i].quantidade += 1;
  }
  const formato = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
  return {
    porSemana,
    barras: contagem.map((c) => ({
      rotulo: formato.format(c.de),
      valor: c.quantidade,
      dica: `${porSemana ? "Semana de " : ""}${formato.format(c.de)}: ${c.quantidade} ${c.quantidade === 1 ? "exercício" : "exercícios"}`,
    })),
  };
}

/** Acerto (0 a 100) por habilidade, somando as respostas. */
export function acertoPorHabilidade(habilidades: AcertoHabilidade[]) {
  const soma = new Map<Habilidade, { acertos: number; total: number }>();
  for (const h of habilidades) {
    const atual = soma.get(h.habilidade) ?? { acertos: 0, total: 0 };
    soma.set(h.habilidade, { acertos: atual.acertos + h.acertos, total: atual.total + h.total });
  }
  return soma;
}

export const DIA_MS = 864e5;

export function diasDesde(data: string) {
  return Math.floor((Date.now() - new Date(data).getTime()) / DIA_MS);
}

export function quandoFoi(data: string) {
  const dias = diasDesde(data);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(data));
}

export const formatarNota = (n: number | null) => (n === null ? "—" : `${Math.round(n)}%`);

/** Mesma régua em toda a tela: verde a partir de 80, azul de 60 a 79, coral abaixo. */
export function tomDaNota(n: number | null): "verde" | "azul" | "coral" | "neutro" {
  if (n === null) return "neutro";
  return n >= 80 ? "verde" : n >= 60 ? "azul" : "coral";
}

/** Aluno que pede atenção: média abaixo de 60 ou parado há mais de 14 dias. */
export const MEDIA_ATENCAO = 60;
export const DIAS_INATIVO = 14;

/** Mostra uma resposta salva do jeito que o aluno a deu (opção, V/F ou o que digitou). */
export function textoDaResposta(q: Pick<QuestaoResultado, "formato" | "conteudo">, r: Record<string, unknown>): string {
  switch (q.formato) {
    case "multipla_escolha":
      return String((q.conteudo.opcoes as string[] | undefined)?.[Number(r.opcao)] ?? "—");
    case "verdadeiro_falso":
      return r.valor === true ? "Verdadeiro" : r.valor === false ? "Falso" : "—";
    case "resposta_curta":
      return String(r.texto ?? "").trim() || "(em branco)";
    case "lacuna_opcoes": {
      const opcoes = (q.conteudo.opcoes as string[][] | undefined) ?? [];
      return ((r.lacunas as number[] | undefined) ?? []).map((i, n) => opcoes[n]?.[i] ?? "—").join(" / ");
    }
    default:
      return ((r.lacunas as string[] | undefined) ?? []).map((t) => String(t).trim() || "(em branco)").join(" / ");
  }
}

/** A resposta certa, no mesmo formato de textoDaResposta. */
export function textoDoGabarito(q: Pick<QuestaoResultado, "formato" | "conteudo" | "gabarito">): string {
  const g = q.gabarito;
  switch (q.formato) {
    case "multipla_escolha":
      return String((q.conteudo.opcoes as string[] | undefined)?.[Number(g.correta)] ?? "—");
    case "verdadeiro_falso":
      return g.valor ? "Verdadeiro" : "Falso";
    case "resposta_curta":
      return ((g.aceitas as string[] | undefined) ?? [])[0] ?? "—";
    case "lacuna_opcoes": {
      const opcoes = (q.conteudo.opcoes as string[][] | undefined) ?? [];
      return ((g.lacunas as number[] | undefined) ?? []).map((i, n) => opcoes[n]?.[i] ?? "—").join(" / ");
    }
    default:
      return ((g.lacunas as string[][] | undefined) ?? []).map((aceitas) => aceitas[0] ?? "—").join(" / ");
  }
}
