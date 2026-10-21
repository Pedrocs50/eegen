import { supabase } from "./supabase";
import { enviarMaterial, linkDoArquivo, TAMANHO_MAXIMO_MB } from "./materiais";
import type { Idioma } from "./idiomas";

/** Um PDF de aula na biblioteca (migração 0015). nivel nulo = ainda sem nível definido. */
export type Material = {
  id: string;
  titulo: string;
  idioma: Idioma;
  nivel: number | null;
  arquivo: string;
  nome_original: string;
  tamanho: number;
  criado_em: string;
};

export const CAMPOS_MATERIAL = "id, titulo, idioma, nivel, arquivo, nome_original, tamanho, criado_em";

// ---------------------------------------------------------------------------
// Nome do arquivo -> título e nível sugeridos
// ---------------------------------------------------------------------------

const PALAVRAS_MENORES = new Set(["and", "of", "the", "to", "in", "a", "an", "for", "on", "at", "by", "with", "or", "de", "la", "el", "los", "las", "y", "en", "del", "da", "do", "das", "dos", "e", "o", "a", "um", "uma", "le", "les", "du", "des", "et"]);

const maiuscula = (palavra: string) => palavra.charAt(0).toLocaleUpperCase("pt-BR") + palavra.slice(1);

/**
 * "ENGLISH CLASS - REGULAR AND IRREGULAR PLURALS (1).pdf" -> "Regular and Irregular Plurals"
 * "1° CLASE DE ESPAÑOL.pdf" -> "1° Clase de Español"
 * Só mexe na caixa quando o nome vem todo em maiúsculas; o resto o professor ajusta na lista.
 */
export function tituloDoArquivo(nomeArquivo: string): string {
  let titulo = nomeArquivo
    .replace(/\.pdf$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/\s*[-–—]\s*c[óo]pia\s*$/i, "")
    .replace(/^c[óo]pia de\s+/i, "")
    .replace(/^(english|spanish|french)\s+class\s*[-–—:]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const letras = titulo.replace(/[^\p{L}]/gu, "");
  const maiusculas = letras.replace(/[^\p{Lu}]/gu, "");
  if (letras.length > 3 && maiusculas.length / letras.length > 0.7) {
    titulo = titulo
      .toLocaleLowerCase("pt-BR")
      .split(" ")
      .map((palavra, i) => (i > 0 && PALAVRAS_MENORES.has(palavra) ? palavra : /^\d/.test(palavra) ? palavra : maiuscula(palavra)))
      .join(" ")
      .replace(/(^|\s)(\d+[°ºª]?)\s+(\p{L})/gu, (_, antes, numero, letra) => `${antes}${numero} ${letra.toLocaleUpperCase("pt-BR")}`);
  }
  return titulo || nomeArquivo.replace(/\.pdf$/i, "");
}

/** Procura o nível no nome (beginner, básico, A2...). Se não achar, devolve null: o professor define depois. */
export function nivelDoNome(nome: string): number | null {
  const n = nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const regras: [RegExp, number][] = [
    [/pre[\s-]?intermediate|pre[\s-]?intermedio|pre[\s-]?intermediaire/, 3],
    [/upper[\s-]?intermediate|intermedio alto|intermediaire avance/, 5],
    [/intermediate|intermedio|intermediaire/, 4],
    [/beginner|principiante|debutant/, 1],
    [/elementary|basico|elementaire/, 2],
    [/advanced|avanzado|avance/, 6],
    [/\ba1\b/, 1],
    [/\ba2\b/, 2],
    [/\bb1\b/, 3],
    [/\bb2\b/, 5],
    [/\bc1\b/, 6],
  ];
  return regras.find(([regra]) => regra.test(n))?.[1] ?? null;
}

/** Ordem "natural": "Aula 2" vem antes de "Aula 10", e "1° Clase" antes de "2° Clase". */
export const ordemNatural = (a: string, b: string) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });

export const tamanhoLegivel = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

// ---------------------------------------------------------------------------
// Envio
// ---------------------------------------------------------------------------

/**
 * Envia um PDF ao bucket privado e o cataloga na biblioteca. Se o catálogo falhar, o arquivo enviado é apagado
 * (para não sobrar PDF solto no bucket).
 */
export async function adicionarABiblioteca(arquivo: File, opcoes: { idioma: Idioma; nivel: number | null; titulo?: string }): Promise<Material> {
  const { caminho, nome } = await enviarMaterial(arquivo);
  const { data, error } = await supabase
    .from("materiais")
    .insert({
      titulo: (opcoes.titulo ?? tituloDoArquivo(nome)).trim() || tituloDoArquivo(nome),
      idioma: opcoes.idioma,
      nivel: opcoes.nivel ?? nivelDoNome(nome),
      arquivo: caminho,
      nome_original: nome,
      tamanho: arquivo.size,
    })
    .select(CAMPOS_MATERIAL)
    .single();
  if (error || !data) {
    await supabase.storage.from("materiais").remove([caminho]);
    throw new Error(`Não foi possível catalogar "${nome}": ${error?.message ?? "erro desconhecido"}`);
  }
  return data as Material;
}

export const erroDeArquivo = (arquivo: File): string | null => {
  const ehPdf = arquivo.type === "application/pdf" || arquivo.name.toLowerCase().endsWith(".pdf");
  if (!ehPdf) return "Não é um PDF.";
  if (arquivo.size > TAMANHO_MAXIMO_MB * 1024 * 1024) return `Tem ${tamanhoLegivel(arquivo.size)}; o máximo é ${TAMANHO_MAXIMO_MB} MB (comprima o PDF e tente de novo).`;
  return null;
};

/** Abre o PDF numa aba nova (a aba é aberta antes do pedido, para o navegador não bloquear). */
export async function abrirMaterial(caminho: string) {
  const aba = window.open("", "_blank");
  try {
    const link = await linkDoArquivo(caminho);
    if (aba) aba.location.href = link;
    else window.location.href = link;
  } catch (e) {
    aba?.close();
    throw e;
  }
}

/** Quantas aulas usam cada PDF (pelo caminho do arquivo). */
export async function usosDosMateriais() {
  const { data, error } = await supabase.from("aulas").select("material_arquivo").neq("material_arquivo", "");
  if (error) return { data: null, error };
  const usos = new Map<string, number>();
  for (const a of data as { material_arquivo: string }[]) usos.set(a.material_arquivo, (usos.get(a.material_arquivo) ?? 0) + 1);
  return { data: usos, error: null };
}
