import { useState } from "react";
import { ArrowDown, ArrowUp, Layers, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { IDIOMAS, nomeNivel, useConsulta, type Idioma } from "../lib/dados";
import { CEFR, ORDEM_IDIOMAS } from "../lib/idiomas";
import { Botao } from "./ui";

type ListaResumo = { id: string; titulo: string; idioma: Idioma; nivel: number; status: "rascunho" | "publicada" };

/**
 * Escolhe as listas de exercícios que aparecem no fim da aula ("Hora de praticar!"), na ordem escolhida.
 * Controlado: recebe e devolve os ids; quem salva é o formulário da aula.
 */
export default function ExerciciosDaAula({
  selecionadas,
  aoMudar,
  rotulo = "Exercícios da aula",
  descricao = "Aparecem no fim da aula, em \"Hora de praticar!\". Cada um abre pelo próprio link.",
  porNivel,
}: {
  selecionadas: string[];
  aoMudar: (ids: string[]) => void;
  rotulo?: string;
  descricao?: string;
  /** Mostra "Adicionar por nível" (várias listas de uma vez); idioma e nível já marcados vêm do curso. */
  porNivel?: { idioma: Idioma; nivel: number };
}) {
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
      <p className="mb-1.5 block text-sm font-semibold text-texto">{rotulo}</p>
      <p className="mb-3 text-xs text-suave">{descricao}</p>

      {porNivel && listas && (
        <PorNivel
          listas={listas}
          selecionadas={selecionadas}
          inicial={porNivel}
          aoAdicionar={(novas) => aoMudar([...selecionadas, ...novas])}
        />
      )}

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
        <span className="sr-only">Adicionar exercício</span>
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

/**
 * Adiciona de uma vez todas as listas publicadas de um ou mais níveis (ex.: Beginner e Elementary).
 * Só entram as que ainda não estão na turma; rascunhos ficam de fora (o aluno não os veria).
 */
function PorNivel({ listas, selecionadas, inicial, aoAdicionar }: {
  listas: ListaResumo[];
  selecionadas: string[];
  inicial: { idioma: Idioma; nivel: number };
  aoAdicionar: (ids: string[]) => void;
}) {
  const [idioma, setIdioma] = useState<Idioma>(inicial.idioma);
  const [niveis, setNiveis] = useState<Set<number>>(new Set([inicial.nivel]));
  const doIdioma = listas.filter((l) => l.idioma === idioma);
  const publicadas = (n: number) => doIdioma.filter((l) => l.nivel === n && l.status === "publicada");
  const novas = doIdioma.filter((l) => niveis.has(l.nivel) && l.status === "publicada" && !selecionadas.includes(l.id));
  const rascunhos = doIdioma.filter((l) => niveis.has(l.nivel) && l.status === "rascunho").length;
  const jaAdicionadas = doIdioma.filter((l) => niveis.has(l.nivel) && l.status === "publicada" && selecionadas.includes(l.id)).length;

  const alternar = (n: number) => {
    const novo = new Set(niveis);
    if (novo.has(n)) novo.delete(n);
    else novo.add(n);
    setNiveis(novo);
  };

  return (
    <div className="mb-4 rounded-2xl border border-destaque/40 bg-destaque-suave p-4">
      <p className="mb-1 flex items-center gap-2 text-sm font-bold text-marca"><Layers className="size-4" /> Adicionar vários de uma vez, por nível</p>
      <p className="mb-3 text-xs text-suave">Marque os níveis e todas as listas publicadas deles entram de uma vez. Dá para marcar mais de um (ex.: Beginner e Elementary).</p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label>
          <span className="sr-only">Idioma</span>
          <select
            value={idioma}
            onChange={(e) => {
              setIdioma(e.target.value as Idioma);
              setNiveis(new Set());
            }}
            className="h-9 rounded-lg border border-borda bg-superficie px-2 text-sm"
          >
            {ORDEM_IDIOMAS.map((i) => <option key={i} value={i}>{IDIOMAS[i]}</option>)}
          </select>
        </label>
        {CEFR.map((c, i) => {
          const n = i + 1;
          const ativo = niveis.has(n);
          const total = publicadas(n).length;
          return (
            <button
              key={n}
              type="button"
              onClick={() => alternar(n)}
              aria-pressed={ativo}
              disabled={total === 0 && !ativo}
              title={`${nomeNivel(idioma, n)}: ${total} ${total === 1 ? "lista publicada" : "listas publicadas"}`}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition disabled:opacity-40 ${
                ativo ? "bg-marca text-sobre-marca" : "border border-borda bg-superficie text-suave hover:text-texto"
              }`}
            >
              {c} · {nomeNivel(idioma, n)} ({total})
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Botao type="button" disabled={novas.length === 0} onClick={() => aoAdicionar(novas.map((l) => l.id))}>
          {novas.length === 0 ? "Nada novo para adicionar" : `Adicionar ${novas.length} ${novas.length === 1 ? "lista" : "listas"}`}
        </Botao>
        <span className="text-xs text-suave">
          {jaAdicionadas > 0 && `${jaAdicionadas} já ${jaAdicionadas === 1 ? "está" : "estão"} na turma. `}
          {rascunhos > 0 && `${rascunhos} ${rascunhos === 1 ? "rascunho fica" : "rascunhos ficam"} de fora até serem publicados.`}
        </span>
      </div>
    </div>
  );
}
