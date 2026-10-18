import type { Idioma } from "./dados";

export type Formato =
  | "multipla_escolha"
  | "verdadeiro_falso"
  | "lacuna"
  | "lacuna_opcoes"
  | "resposta_curta"
  | "completar_letras";

export type Habilidade = "listening" | "reading" | "grammar" | "vocabulary" | "writing";
export type TipoEstimulo = "nenhum" | "texto" | "audio" | "dica";

export const FORMATOS: Record<Formato, { nome: string; descricao: string }> = {
  multipla_escolha: { nome: "Múltipla escolha", descricao: "Uma alternativa correta" },
  verdadeiro_falso: { nome: "Verdadeiro ou falso", descricao: "True / False" },
  lacuna: { nome: "Lacuna", descricao: "O aluno digita a palavra que falta" },
  lacuna_opcoes: { nome: "Lacuna com opções", descricao: "O aluno escolhe a palavra que falta" },
  resposta_curta: { nome: "Resposta curta", descricao: "Por extenso, tradução curta" },
  completar_letras: { nome: "Completar letras", descricao: "Ex.: Co_bustible" },
};

export const HABILIDADES: Record<Habilidade, string> = {
  listening: "Listening",
  reading: "Reading",
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  writing: "Writing",
};

export const ESTIMULOS: Record<TipoEstimulo, string> = {
  nenhum: "Só questões",
  texto: "Texto para ler",
  dica: "Dica (cartão, sem questões)",
  audio: "Áudio (em breve)",
};

/** Gabarito por formato. Fica numa tabela que o aluno não consegue ler. */
export type Gabarito = {
  correta?: number;
  valor?: boolean;
  lacunas?: (string[] | number)[];
  aceitas?: string[];
  ignorar_acentos?: boolean;
};

export type Conteudo = {
  opcoes?: string[] | string[][];
  banco?: string[];
  dica?: string;
};

export type Questao = {
  id: string;
  formato: Formato;
  habilidade: Habilidade;
  enunciado: string;
  conteudo: Conteudo;
  pontos: number;
  gabarito: Gabarito;
  explicacao: string;
};

export type Secao = {
  id: string;
  titulo: string;
  instrucao: string;
  tipo_estimulo: TipoEstimulo;
  estimulo: { texto?: string };
  questoes: Questao[];
};

export type Lista = {
  id: string;
  titulo: string;
  tema: string;
  descricao: string;
  idioma: Idioma;
  nivel: number;
  status: "rascunho" | "publicada";
  origem?: string;
  secoes: Secao[];
};

/** Cada sequência de "_" no enunciado é uma lacuna. */
export const PADRAO_LACUNA = /_+/g;

export function contarLacunas(enunciado: string) {
  return (enunciado.match(PADRAO_LACUNA) ?? []).length;
}

/** Divide o enunciado em pedaços de texto; entre cada par de pedaços vem uma lacuna. */
export function partesDoEnunciado(enunciado: string) {
  return enunciado.split(PADRAO_LACUNA);
}

export function novoId() {
  return crypto.randomUUID();
}

export function novaQuestao(formato: Formato, habilidade: Habilidade = "grammar"): Questao {
  const base = { id: novoId(), formato, habilidade, pontos: 1, explicacao: "", conteudo: {}, gabarito: {} };
  switch (formato) {
    case "multipla_escolha":
      return { ...base, enunciado: "", conteudo: { opcoes: ["", "", ""] }, gabarito: { correta: 0 } };
    case "verdadeiro_falso":
      return { ...base, enunciado: "", gabarito: { valor: true } };
    case "lacuna":
      return { ...base, enunciado: "I ___ to work by bus.", gabarito: { lacunas: [["go"]] } };
    case "lacuna_opcoes":
      return { ...base, enunciado: "Ana ___ Isabel van al cine.", conteudo: { opcoes: [["y", "e"]] }, gabarito: { lacunas: [1] } };
    case "resposta_curta":
      return { ...base, enunciado: "", gabarito: { aceitas: [""] } };
    case "completar_letras":
      return { ...base, habilidade: "vocabulary", enunciado: "Co_bustible", gabarito: { lacunas: [["m"]] } };
  }
}

export function novaSecao(): Secao {
  return { id: novoId(), titulo: "", instrucao: "", tipo_estimulo: "nenhum", estimulo: {}, questoes: [] };
}

export function novaLista(): Lista {
  return {
    id: novoId(),
    titulo: "",
    tema: "",
    descricao: "",
    idioma: "ingles",
    nivel: 1,
    status: "rascunho",
    secoes: [{ ...novaSecao(), titulo: "Exercícios práticos" }],
  };
}

/** Problemas que impedem o aluno de responder direito. Vazio = questão pronta. */
export function problemasDaQuestao(q: Questao): string[] {
  const problemas: string[] = [];
  if (q.formato !== "completar_letras" && !q.enunciado.trim()) problemas.push("Falta o enunciado.");
  switch (q.formato) {
    case "multipla_escolha": {
      const opcoes = (q.conteudo.opcoes as string[] | undefined) ?? [];
      if (opcoes.filter((o) => o.trim()).length < 2) problemas.push("Coloque pelo menos 2 alternativas.");
      if (opcoes.some((o) => !o.trim())) problemas.push("Há alternativa em branco.");
      break;
    }
    case "lacuna":
    case "completar_letras": {
      const n = contarLacunas(q.enunciado);
      if (n === 0) problemas.push("Marque as lacunas com _ no enunciado.");
      const lacunas = (q.gabarito.lacunas as string[][] | undefined) ?? [];
      if (lacunas.slice(0, n).some((aceitas) => !aceitas?.some((a) => a.trim()))) problemas.push("Toda lacuna precisa de resposta.");
      break;
    }
    case "lacuna_opcoes": {
      const n = contarLacunas(q.enunciado);
      if (n === 0) problemas.push("Marque as lacunas com _ no enunciado.");
      const opcoes = (q.conteudo.opcoes as string[][] | undefined) ?? [];
      if (opcoes.slice(0, n).some((o) => !o || o.filter((x) => x.trim()).length < 2)) problemas.push("Cada lacuna precisa de pelo menos 2 opções.");
      break;
    }
    case "resposta_curta":
      if (!q.gabarito.aceitas?.some((a) => a.trim())) problemas.push("Coloque pelo menos uma resposta aceita.");
      break;
  }
  return problemas;
}

/** Ajusta o gabarito e as opções ao número de lacunas do enunciado. */
export function sincronizarLacunas(q: Questao): Questao {
  if (q.formato !== "lacuna" && q.formato !== "completar_letras" && q.formato !== "lacuna_opcoes") return q;
  const n = contarLacunas(q.enunciado);
  if (q.formato === "lacuna_opcoes") {
    const opcoes = [...((q.conteudo.opcoes as string[][] | undefined) ?? [])];
    const corretas = [...((q.gabarito.lacunas as number[] | undefined) ?? [])];
    while (opcoes.length < n) opcoes.push(["", ""]);
    while (corretas.length < n) corretas.push(0);
    return { ...q, conteudo: { ...q.conteudo, opcoes: opcoes.slice(0, n) }, gabarito: { ...q.gabarito, lacunas: corretas.slice(0, n) } };
  }
  const lacunas = [...((q.gabarito.lacunas as string[][] | undefined) ?? [])];
  while (lacunas.length < n) lacunas.push([""]);
  return { ...q, gabarito: { ...q.gabarito, lacunas: lacunas.slice(0, n) } };
}

/** Resposta do aluno, no formato que a função enviar_tentativa espera. */
export type Resposta = { opcao?: number; valor?: boolean; lacunas?: (string | number)[]; texto?: string };

export function respondida(q: Pick<Questao, "formato" | "enunciado">, r: Resposta | undefined): boolean {
  if (!r) return false;
  switch (q.formato) {
    case "multipla_escolha":
      return r.opcao !== undefined;
    case "verdadeiro_falso":
      return r.valor !== undefined;
    case "resposta_curta":
      return !!r.texto?.trim();
    default:
      return (r.lacunas ?? []).filter((v) => v !== undefined && v !== "").length >= contarLacunas(q.enunciado);
  }
}

const SEM_ACENTO: Record<string, string> = Object.fromEntries(
  [..."áàâãäéèêëíìîïóòôõöúùûüç"].map((c, i) => [c, "aaaaaeeeeiiiiooooouuuuc"[i]]),
);

/** Mesma normalização da função normalizar_resposta do banco (para mostrar a correção igual à nota). */
export function normalizarResposta(texto: string | undefined, ignorarAcentos = false) {
  let s = (texto ?? "").toLowerCase().replace(/[’‘]/g, "'").replace(/[-‐–—]/g, " ");
  s = s.replace(/^[\s.,;:!?¿¡"“”]+|[\s.,;:!?¿¡"“”]+$/g, "").replace(/\s+/g, " ");
  // Mesmas letras da função translate() do banco: o "ñ" continua valendo como letra própria.
  if (ignorarAcentos) s = s.replace(/[áàâãäéèêëíìîïóòôõöúùûüç]/g, (c) => SEM_ACENTO[c] ?? c);
  return s;
}
