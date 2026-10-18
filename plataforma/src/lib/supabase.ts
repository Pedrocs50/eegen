import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const chave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !chave) {
  throw new Error("Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY em plataforma/.env.local");
}

export const supabase = createClient(url, chave);

export type Papel = "admin" | "professor" | "aluno";

export type Perfil = {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  criado_em: string;
};

export const NOMES_PAPEIS: Record<Papel, string> = {
  admin: "Admin",
  professor: "Professor",
  aluno: "Aluno",
};

/** Traduz as mensagens de erro mais comuns do Supabase Auth. */
export function traduzirErro(mensagem: string): string {
  const texto = mensagem.toLowerCase();
  if (texto.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (texto.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar. Procure a mensagem na sua caixa de entrada.";
  if (texto.includes("already registered")) return "Já existe uma conta com esse e-mail. Tente entrar.";
  if (texto.includes("rate limit") || texto.includes("too many")) return "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.";
  if (texto.includes("password should be at least")) return "A senha precisa ter pelo menos 8 caracteres.";
  if (texto.includes("same as the old")) return "A nova senha precisa ser diferente da anterior.";
  if (texto.includes("failed to fetch")) return "Sem conexão com o servidor. Verifique sua internet.";
  if (texto.includes("row-level security") || texto.includes("permission denied")) return "Você não tem permissão para fazer isso.";
  if (texto.includes("violates foreign key")) return "Esse item está ligado a outros dados e não pode ser alterado assim.";
  return mensagem;
}
