import { useState, type ReactNode } from "react";
import { Check, MessageSquareShare } from "lucide-react";

/**
 * Copia uma mensagem pronta (convite, aviso de aula) para colar no grupo da turma.
 * Se o navegador não deixar copiar, mostra o texto para copiar à mão.
 */
export default function CopiarTexto({ texto, children = "Copiar aviso", copiado: rotuloCopiado = "Copiado! Cole no grupo", compacto = false, className = "", dica = "Copiar mensagem para o grupo da turma" }: {
  texto: string;
  children?: ReactNode;
  copiado?: string;
  compacto?: boolean;
  className?: string;
  dica?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar(evento: React.MouseEvent) {
    evento.preventDefault();
    evento.stopPropagation();
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      prompt("Copie a mensagem:", texto);
    }
  }

  if (compacto) {
    return (
      <button onClick={copiar} title={dica} aria-label={dica} className={`grid size-9 shrink-0 place-items-center rounded-lg text-suave hover:bg-destaque-suave hover:text-marca ${className}`}>
        {copiado ? <Check className="size-4 text-sucesso" /> : <MessageSquareShare className="size-4" />}
      </button>
    );
  }
  return (
    <button onClick={copiar} className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-borda bg-superficie px-4 text-sm font-semibold text-texto hover:bg-fundo ${className}`}>
      {copiado ? <><Check className="size-4 text-sucesso" /> {rotuloCopiado}</> : <><MessageSquareShare className="size-4" /> {children}</>}
    </button>
  );
}
