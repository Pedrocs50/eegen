import { ArrowDown, ArrowUp, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { IDIOMAS, nomeNivel, useConsulta, type Idioma } from "../lib/dados";
import { ORDEM_IDIOMAS } from "../lib/idiomas";

type ListaResumo = { id: string; titulo: string; idioma: Idioma; nivel: number; status: "rascunho" | "publicada" };

/**
 * Escolhe as listas de exercícios que aparecem no fim da aula ("Hora de praticar!"), na ordem escolhida.
 * Controlado: recebe e devolve os ids; quem salva é o formulário da aula.
 */
export default function ExerciciosDaAula({ selecionadas, aoMudar }: { selecionadas: string[]; aoMudar: (ids: string[]) => void }) {
  const { dados: listas } = useConsulta<ListaResumo[]>(() =>
    supabase.from("listas").select("id, titulo, idioma, nivel, status").order("nivel").order("titulo"),
  );
  const porId = new Map((listas ?? []).map((l) => [l.id, l]));
  const disponiveis = (listas ?? []).filter((l) => !selecionadas.includes(l.id));

  const mover = (de: number, para: number) => {
    if (para < 0 || para >= selecionadas.length) return;
    const nova = [...selecionadas];
    const [item] = nova.splice(de, 1);
    nova.splice(para, 0, item);
    aoMudar(nova);
  };

  return (
    <div>
      <p className="mb-1.5 block text-sm font-semibold text-texto">Exercícios da aula</p>
      <p className="mb-3 text-xs text-suave">Aparecem no fim da aula, em "Hora de praticar!". Cada um abre pelo próprio link.</p>

      {selecionadas.length > 0 && (
        <ol className="mb-3 space-y-2">
          {selecionadas.map((id, i) => {
            const lista = porId.get(id);
            return (
              <li key={id} className="flex items-center gap-2 rounded-xl border border-borda bg-superficie px-3 py-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-creme text-xs font-bold text-suave">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {lista ? lista.titulo : "Lista removida"}
                  {lista && <span className="ml-2 text-xs text-suave">{IDIOMAS[lista.idioma]} · {nomeNivel(lista.idioma, lista.nivel)}</span>}
                  {lista?.status === "rascunho" && <span className="ml-2 rounded-full bg-coral-suave px-2 py-0.5 text-[10px] font-bold text-coral uppercase">Rascunho</span>}
                </span>
                <button type="button" onClick={() => mover(i, i - 1)} aria-label="Subir" className="grid size-8 place-items-center rounded-lg text-suave hover:bg-fundo"><ArrowUp className="size-4" /></button>
                <button type="button" onClick={() => mover(i, i + 1)} aria-label="Descer" className="grid size-8 place-items-center rounded-lg text-suave hover:bg-fundo"><ArrowDown className="size-4" /></button>
                <button type="button" onClick={() => aoMudar(selecionadas.filter((x) => x !== id))} aria-label="Tirar da aula" className="grid size-8 place-items-center rounded-lg text-suave hover:bg-erro-suave hover:text-erro"><X className="size-4" /></button>
              </li>
            );
          })}
        </ol>
      )}

      <label className="block">
        <span className="sr-only">Adicionar exercício à aula</span>
        <select
          value=""
          onChange={(e) => e.target.value && aoMudar([...selecionadas, e.target.value])}
          className="h-11 w-full rounded-xl border border-borda bg-superficie px-3 text-sm"
          disabled={!listas}
        >
          <option value="">{listas ? (disponiveis.length ? "+ Adicionar exercício…" : "Todas as listas já estão nesta aula") : "Carregando listas…"}</option>
          {ORDEM_IDIOMAS.map((idioma) => {
            const doIdioma = disponiveis.filter((l) => l.idioma === idioma);
            if (doIdioma.length === 0) return null;
            return (
              <optgroup key={idioma} label={IDIOMAS[idioma]}>
                {doIdioma.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.titulo} · {nomeNivel(l.idioma, l.nivel)}{l.status === "rascunho" ? " (rascunho)" : ""}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </label>
      {selecionadas.some((id) => porId.get(id)?.status === "rascunho") && (
        <p className="mt-2 text-xs text-coral">Listas em rascunho aparecem na aula só depois de publicadas.</p>
      )}
    </div>
  );
}
