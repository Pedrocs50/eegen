import { useState } from "react";
import { entrarComGoogle, useGoogleLigado } from "../lib/google";
import { traduzirErro } from "../lib/supabase";
import { Aviso } from "./ui";

/** Logotipo oficial do Google (as quatro cores), como pede a marca. */
function LogoGoogle() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/**
 * "Continuar com Google". Só aparece quando o Google está ligado no Supabase.
 * `destino`: para onde a pessoa volta depois do login (um caminho do site). `desabilitado` + `dica` seguram o botão
 * até a tela ter o que precisa (no cadastro, o código da turma).
 */
export default function BotaoGoogle({ destino, desabilitado = false, dica, rotulo = "Continuar com Google" }: {
  destino: string;
  desabilitado?: boolean;
  dica?: string;
  rotulo?: string;
}) {
  const ligado = useGoogleLigado();
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState("");
  if (!ligado) return null;

  async function clicar() {
    setErro("");
    setAbrindo(true);
    const { error } = await entrarComGoogle(destino);
    // Sem erro, o navegador já está indo para o Google. Com erro, volta ao normal e avisa.
    if (error) {
      setAbrindo(false);
      setErro(traduzirErro(error.message));
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={clicar}
        disabled={desabilitado || abrindo}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-borda bg-superficie px-4 font-semibold text-texto transition hover:bg-fundo disabled:cursor-not-allowed disabled:opacity-60"
      >
        <LogoGoogle /> {abrindo ? "Abrindo o Google…" : rotulo}
      </button>
      {desabilitado && dica && <p className="mt-1.5 text-center text-xs text-suave">{dica}</p>}
      {erro && <div className="mt-3"><Aviso>{erro}</Aviso></div>}
    </div>
  );
}

/** Linha "ou", para separar o botão do Google do formulário de e-mail. Só aparece junto com o botão. */
export function SeparadorOu({ texto = "ou" }: { texto?: string }) {
  const ligado = useGoogleLigado();
  if (!ligado) return null;
  return (
    <div className="flex items-center gap-3 text-xs font-semibold text-suave" role="separator">
      <span className="h-px flex-1 bg-borda" /> {texto} <span className="h-px flex-1 bg-borda" />
    </div>
  );
}
