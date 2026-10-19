import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { linkDoExercicio } from "../lib/volta";

/**
 * Copia o link do exercício para mandar aos alunos (WhatsApp, e-mail, final da aula...).
 * Quem abrir sem estar logado entra ou cria a conta e cai direto no exercício.
 */
export default function CopiarLink({ idLista, compacto = false, publicada = true }: { idLista: string; compacto?: boolean; publicada?: boolean }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar(evento: React.MouseEvent) {
    // Dentro de uma linha clicável da lista, o clique não deve abrir a lista.
    evento.preventDefault();
    evento.stopPropagation();
    const link = linkDoExercicio(idLista);
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      prompt("Copie o link do exercício:", link);
    }
  }

  const dica = publicada ? "Copiar o link para mandar aos alunos" : "Copiar o link (os alunos só abrem depois de publicada)";
  if (compacto) {
    return (
      <button onClick={copiar} title={dica} aria-label={dica} className="grid size-9 shrink-0 place-items-center rounded-lg text-suave hover:bg-destaque-suave hover:text-marca">
        {copiado ? <Check className="size-4 text-sucesso" /> : <Link2 className="size-4" />}
      </button>
    );
  }
  return (
    <button onClick={copiar} title={dica} className="inline-flex h-11 items-center gap-2 rounded-xl border border-borda bg-superficie px-4 text-sm font-semibold text-texto hover:bg-fundo">
      {copiado ? <><Check className="size-4 text-sucesso" /> Link copiado</> : <><Link2 className="size-4" /> Copiar link</>}
    </button>
  );
}
