import { useEffect, useState } from "react";
import { supabase } from "./supabase";

const url = import.meta.env.VITE_SUPABASE_URL;
const chave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

let lembrado: boolean | null = null;

/**
 * O Supabase diz, sem login, quais formas de entrar estão ligadas no painel dele. O botão "Continuar com Google" só
 * aparece quando o Google está ligado: assim o código pode ir ao ar antes da configuração, sem botão quebrado.
 */
export function useGoogleLigado() {
  const [ligado, setLigado] = useState(lembrado ?? false);
  useEffect(() => {
    if (lembrado !== null) return;
    let ativo = true;
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: chave } })
      .then((r) => r.json())
      .then((d) => {
        lembrado = !!d?.external?.google;
        if (ativo) setLigado(lembrado);
      })
      .catch(() => {
        /* sem conexão: o botão simplesmente não aparece */
      });
    return () => {
      ativo = false;
    };
  }, []);
  return ligado;
}

/** Abre a tela de login do Google e volta para `destino` (um caminho do próprio site). */
export function entrarComGoogle(destino: string) {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    // select_account: quem tem várias contas Google escolhe qual usar, em vez de entrar na primeira.
    options: { redirectTo: `${window.location.origin}${destino}`, queryParams: { prompt: "select_account" } },
  });
}
