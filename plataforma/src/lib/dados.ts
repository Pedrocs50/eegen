import { useCallback, useEffect, useState } from "react";
import { traduzirErro } from "./supabase";

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
  material_url: string;
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
