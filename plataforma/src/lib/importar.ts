import type { Idioma } from "./dados";
import {
  FORMATOS,
  HABILIDADES,
  novaSecao,
  novoId,
  sincronizarLacunas,
  type Formato,
  type Habilidade,
  type Lista,
  type Questao,
  type Secao,
} from "./exercicios";

/**
 * Formato que pedimos ao Claude. É mais "achatado" que o do banco (sem conteudo/gabarito),
 * porque modelos erram menos com campos diretos. O conversor abaixo monta o formato interno.
 */
export const EXEMPLO_IMPORTACAO = {
  titulo: "Prepositions of movement",
  tema: "Prepositions",
  descricao: "Vamos aprender como indicar a direção certa?",
  idioma: "ingles",
  nivel: 1,
  secoes: [
    { tipo: "dica", titulo: "Dica", texto: "Across = de um lado ao outro. Through = por dentro de algo." },
    {
      tipo: "questoes",
      titulo: "Escolha a alternativa correta",
      instrucao: "Leia a frase e escolha a preposição certa.",
      questoes: [
        { formato: "multipla_escolha", habilidade: "grammar", enunciado: "The cat jumped ___ the box.", opcoes: ["into", "across", "along"], correta: 0, explicacao: "Into indica movimento para dentro." },
        { formato: "verdadeiro_falso", habilidade: "grammar", enunciado: "We use 'through' for movement from one side to the other of a flat surface.", resposta: false, explicacao: "Para superfície usamos 'across'." },
        { formato: "lacuna", habilidade: "grammar", enunciado: "She walked ___ the park and ___ the river.", respostas: [["through"], ["along"]], banco: ["through", "along", "into"], explicacao: "Through = por dentro; along = ao longo." },
        { formato: "lacuna_opcoes", habilidade: "grammar", enunciado: "He drove ___ the bridge.", opcoes: [["across", "into"]], corretas: [0], explicacao: "Atravessar a ponte: across." },
        { formato: "resposta_curta", habilidade: "vocabulary", enunciado: "Escreva por extenso: 41", aceitas: ["forty-one", "forty one"], explicacao: "Dezenas e unidades com hífen." },
        { formato: "completar_letras", habilidade: "vocabulary", enunciado: "Co_bustible", respostas: [["m"]], explicacao: "Antes de B e P usamos M." },
      ],
    },
    {
      tipo: "texto",
      titulo: "Reading: A trip to the coast",
      texto: "Last weekend, Maya drove across the city ...",
      questoes: [{ formato: "verdadeiro_falso", habilidade: "reading", enunciado: "Maya went by train.", resposta: false, explicacao: "Ela foi de carro (drove)." }],
    },
  ],
};

/** Lê o JSON que veio do Claude tolerando bloco ```json, texto em volta, vírgula sobrando e aspas curvas. */
export function lerJsonDoClaude(texto: string): unknown {
  let limpo = texto.trim();
  const bloco = limpo.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (bloco) limpo = bloco[1].trim();
  const inicio = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  if (inicio === -1 || fim <= inicio) throw new Error("Não encontrei um objeto JSON no texto colado. Cole a resposta inteira do Claude.");
  limpo = limpo.slice(inicio, fim + 1);
  try {
    return JSON.parse(limpo);
  } catch {
    // Deslizes comuns de modelos: vírgula antes de fechar e aspas tipográficas nas chaves.
    const consertado = limpo.replace(/,\s*([}\]])/g, "$1").replace(/[“”]/g, '"');
    try {
      return JSON.parse(consertado);
    } catch (erro) {
      throw new Error(`O texto colado não é um JSON válido (${(erro as Error).message}). Peça ao Claude para devolver só o JSON.`);
    }
  }
}

type Objeto = Record<string, unknown>;
const texto = (v: unknown) => (typeof v === "string" ? v : v === undefined || v === null ? "" : String(v));
const listaDeTextos = (v: unknown) => (Array.isArray(v) ? v.map(texto) : typeof v === "string" ? [v] : []);
const listaDeListas = (v: unknown) => (Array.isArray(v) ? v.map((item) => listaDeTextos(item)) : []);
const numeros = (v: unknown) => (Array.isArray(v) ? v.map((n) => Number(n) || 0) : []);

function habilidade(v: unknown, padrao: Habilidade): Habilidade {
  const valor = texto(v).toLowerCase();
  return valor in HABILIDADES ? (valor as Habilidade) : padrao;
}

/** Converte uma questão do formato de importação para o formato do editor. */
function converterQuestao(bruta: Objeto, padrao: Habilidade): Questao | string {
  const formato = texto(bruta.formato) as Formato;
  if (!(formato in FORMATOS)) return `formato desconhecido "${texto(bruta.formato)}"`;
  const base = {
    id: novoId(),
    formato,
    habilidade: habilidade(bruta.habilidade, padrao),
    enunciado: texto(bruta.enunciado),
    pontos: 1,
    explicacao: texto(bruta.explicacao),
  };
  const ignorar_acentos = bruta.ignorar_acentos === true;

  switch (formato) {
    case "multipla_escolha": {
      const opcoes = listaDeTextos(bruta.opcoes).slice(0, 5);
      const correta = Math.min(Math.max(Number(bruta.correta) || 0, 0), Math.max(opcoes.length - 1, 0));
      return { ...base, conteudo: { opcoes }, gabarito: { correta } };
    }
    case "verdadeiro_falso": {
      const valor = bruta.resposta === true || texto(bruta.resposta).toLowerCase() === "true";
      return { ...base, conteudo: {}, gabarito: { valor } };
    }
    case "lacuna":
    case "completar_letras":
      return sincronizarLacunas({
        ...base,
        conteudo: formato === "lacuna" ? { banco: listaDeTextos(bruta.banco) } : {},
        gabarito: { lacunas: listaDeListas(bruta.respostas), ignorar_acentos },
      });
    case "lacuna_opcoes":
      return sincronizarLacunas({ ...base, conteudo: { opcoes: listaDeListas(bruta.opcoes) }, gabarito: { lacunas: numeros(bruta.corretas) } });
    case "resposta_curta":
      return { ...base, conteudo: {}, gabarito: { aceitas: listaDeTextos(bruta.aceitas), ignorar_acentos } };
  }
}

export type ResultadoImportacao = {
  dados: Pick<Lista, "titulo" | "tema" | "descricao"> & { idioma?: Idioma; nivel?: number };
  secoes: Secao[];
  avisos: string[];
  totalQuestoes: number;
};

/** Valida e converte o JSON importado. Questões com formato desconhecido são puladas e listadas nos avisos. */
export function converterImportacao(bruto: unknown): ResultadoImportacao {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) {
    throw new Error("O JSON precisa ser um objeto com \"titulo\" e \"secoes\".");
  }
  const raiz = bruto as Objeto;
  if (!Array.isArray(raiz.secoes) || raiz.secoes.length === 0) {
    throw new Error("O JSON não tem \"secoes\". Confira se o Claude seguiu o formato pedido.");
  }

  const avisos: string[] = [];
  let totalQuestoes = 0;
  const secoes = (raiz.secoes as Objeto[]).map((brutaSecao, i) => {
    const tipo = texto(brutaSecao.tipo).toLowerCase();
    const secao: Secao = {
      ...novaSecao(),
      titulo: texto(brutaSecao.titulo),
      instrucao: texto(brutaSecao.instrucao),
      tipo_estimulo: tipo === "dica" ? "dica" : tipo === "texto" ? "texto" : "nenhum",
      estimulo: tipo === "dica" || tipo === "texto" ? { texto: texto(brutaSecao.texto) } : {},
    };
    const padrao: Habilidade = tipo === "texto" ? "reading" : "grammar";
    const questoes = Array.isArray(brutaSecao.questoes) ? (brutaSecao.questoes as Objeto[]) : [];
    if (secao.tipo_estimulo === "dica" && questoes.length > 0) {
      avisos.push(`Seção ${i + 1} é uma dica: as ${questoes.length} questões dela foram ignoradas.`);
      return secao;
    }
    questoes.forEach((brutaQuestao, j) => {
      const convertida = converterQuestao(brutaQuestao, padrao);
      if (typeof convertida === "string") avisos.push(`Seção ${i + 1}, questão ${j + 1}: ${convertida}; pulada.`);
      else {
        secao.questoes.push(convertida);
        totalQuestoes += 1;
      }
    });
    return secao;
  });

  const idioma = raiz.idioma === "espanhol" || raiz.idioma === "ingles" ? (raiz.idioma as Idioma) : undefined;
  const nivel = Number(raiz.nivel);
  return {
    dados: {
      titulo: texto(raiz.titulo),
      tema: texto(raiz.tema),
      descricao: texto(raiz.descricao),
      idioma,
      nivel: nivel >= 1 && nivel <= 6 ? nivel : undefined,
    },
    secoes,
    avisos,
    totalQuestoes,
  };
}
