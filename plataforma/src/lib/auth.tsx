import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, type Perfil } from "./supabase";

type EstadoAuth = {
  sessao: Session | null;
  perfil: Perfil | null;
  /** true enquanto a sessão ou o perfil do usuário logado ainda não chegaram. */
  carregando: boolean;
  recarregarPerfil: () => Promise<void>;
  sair: () => Promise<void>;
};

const ContextoAuth = createContext<EstadoAuth | null>(null);

export function ProvedorAuth({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [sessaoLida, setSessaoLida] = useState(false);
  // Guarda de qual usuário é o perfil, para saber se ele já carregou.
  const [carregado, setCarregado] = useState<{ idUsuario: string; perfil: Perfil | null } | null>(null);

  const buscarPerfil = useCallback(async (idUsuario: string) => {
    const { data } = await supabase.from("perfis").select("*").eq("id", idUsuario).maybeSingle();
    setCarregado({ idUsuario, perfil: data as Perfil | null });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      setSessaoLida(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, novaSessao) => setSessao(novaSessao));
    return () => data.subscription.unsubscribe();
  }, []);

  const idUsuario = sessao?.user.id;
  useEffect(() => {
    // Fora do callback do onAuthStateChange: chamar o Supabase lá dentro pode travar a sessão.
    if (idUsuario) buscarPerfil(idUsuario);
  }, [idUsuario, buscarPerfil]);

  const perfilAtual = idUsuario && carregado?.idUsuario === idUsuario ? carregado.perfil : null;
  const valor: EstadoAuth = {
    sessao,
    perfil: perfilAtual,
    carregando: !sessaoLida || (!!idUsuario && carregado?.idUsuario !== idUsuario),
    recarregarPerfil: async () => {
      if (idUsuario) await buscarPerfil(idUsuario);
    },
    sair: async () => {
      await supabase.auth.signOut();
    },
  };

  return <ContextoAuth.Provider value={valor}>{children}</ContextoAuth.Provider>;
}

export function useAuth(): EstadoAuth {
  const contexto = useContext(ContextoAuth);
  if (!contexto) throw new Error("useAuth precisa estar dentro de <ProvedorAuth>.");
  return contexto;
}
