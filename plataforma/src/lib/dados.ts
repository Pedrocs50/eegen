import { useCallback, useEffect, useState } from "react";
import { traduzirErro } from "./supabase";

export { IDIOMAS, NIVEIS, nomeNivel, type Idioma } from "./idiomas";
import type { Idioma } from "./idiomas";

export type Curso = {
  id: string;
  titulo: string;
  idioma: Idioma;
  nivel: number;
  descricao: string;
  criado_em: string;
};

export type Aula = {
  id: string;
  curso_id: string;
  numero: number;
  titulo: string;
  subtitulo: string;
  /** Link externo (Google Drive, PDF na web). */
  material_url: string;
  /** PDF enviado: caminho no bucket privado "materiais" e o nome original do arquivo. */
  material_arquivo: string;
  material_nome: string;
};

export type Turma = {
  id: string;
  nome: string;
  curso_id: string;
  professor_id: string;
  codigo: string;
  ativa: boolean;
  criado_em: string;
};

// Sem os tipos gerados do banco, o Supabase não sabe o formato das junções; cada tela declara o seu.
type ResultadoSupabase = PromiseLike<{ data: unknown; error: { message: string } | null }>;

/** Executa uma consulta do Supabase ao abrir a tela e oferece "recarregar" depois de salvar algo. */
export function useConsulta<T>(consulta: () => ResultadoSupabase, dependencias: unknown[] = []) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  // Refaz a consulta só quando as dependências mudam (por exemplo, o id da página).
  const executar = useCallback(consulta, dependencias);

  const recarregar = useCallback(async () => {
    const { data, error } = await executar();
    if (error) setErro(traduzirErro(error.message));
    else {
      setErro("");
      setDados(data as T);
    }
    setCarregando(false);
  }, [executar]);

  useEffect(() => {
    setCarregando(true);
    recarregar();
  }, [recarregar]);

  return { dados, erro, carregando, recarregar, setDados };
}
