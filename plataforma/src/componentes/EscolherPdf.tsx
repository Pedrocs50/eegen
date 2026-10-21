import { useState } from "react";
import { Link } from "react-router";
import { FileText } from "lucide-react";
import { supabase } from "../lib/supabase";
import { IDIOMAS, nomeNivel, useConsulta, type Idioma } from "../lib/dados";
import { CEFR, ORDEM_IDIOMAS } from "../lib/idiomas";
import { CAMPOS_MATERIAL, ordemNatural, type Material } from "../lib/biblioteca";

/** Escolhe um PDF já guardado na biblioteca (sem enviar de novo). Os do nível do curso aparecem primeiro. */
export default function EscolherPdf({ idioma, nivel, escolhido, aoEscolher }: {
  idioma: Idioma;
  nivel: number;
  escolhido: string | null;
  aoEscolher: (material: Material) => void;
}) {
  const { dados, carregando } = useConsulta<Material[]>(() => supabase.from("materiais").select(CAMPOS_MATERIAL));
  const [filtroIdioma, setFiltroIdioma] = useState<Idioma>(idioma);
  const [soDoNivel, setSoDoNivel] = useState(false);
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const lista = (dados ?? [])
    .filter((m) => m.idioma === filtroIdioma && (!soDoNivel || m.nivel === nivel) && (!termo || `${m.titulo} ${m.nome_original}`.toLowerCase().includes(termo)))
    .sort((a, b) => Number(b.nivel === nivel) - Number(a.nivel === nivel) || (a.nivel ?? 99) - (b.nivel ?? 99) || ordemNatural(a.titulo, b.titulo));

  if (carregando && !dados) return <p className="text-sm text-suave">Carregando a biblioteca…</p>;
  if ((dados ?? []).length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-borda p-4 text-sm text-suave">
        A biblioteca ainda está vazia. Envie os PDFs das aulas em <Link to="/biblioteca" className="font-semibold text-destaque underline">Biblioteca → Aulas em PDF</Link> e volte aqui para escolher.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-borda p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <label>
          <span className="sr-only">Idioma</span>
          <select value={filtroIdioma} onChange={(e) => setFiltroIdioma(e.target.value as Idioma)} className="h-9 rounded-lg border border-borda bg-superficie px-2 text-sm">
            {ORDEM_IDIOMAS.map((i) => <option key={i} value={i}>{IDIOMAS[i]}</option>)}
          </select>
        </label>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar pelo título"
          aria-label="Buscar PDF"
          className="h-9 min-w-40 flex-1 rounded-lg border border-borda bg-superficie px-3 text-sm focus:border-destaque focus:outline-none"
        />
        <label className="flex items-center gap-1.5 text-xs text-suave">
          <input type="checkbox" checked={soDoNivel} onChange={(e) => setSoDoNivel(e.target.checked)} className="size-4 accent-[var(--c-marca)]" />
          Só do nível do curso
        </label>
      </div>
      <ul className="max-h-64 space-y-1 overflow-y-auto" role="listbox" aria-label="PDFs da biblioteca">
        {lista.length === 0 && <li className="p-3 text-center text-sm text-suave">Nenhum PDF com esses filtros.</li>}
        {lista.map((m) => {
          const ativo = m.arquivo === escolhido;
          return (
            <li key={m.id}>
              <button
                type="button"
                role="option"
                aria-selected={ativo}
                onClick={() => aoEscolher(m)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${ativo ? "bg-marca text-sobre-marca" : "hover:bg-fundo"}`}
              >
                <FileText className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate font-semibold">{m.titulo}</span>
                <span className={`shrink-0 text-xs ${ativo ? "text-sobre-marca/80" : "text-suave"}`}>{m.nivel ? `${CEFR[m.nivel - 1]} · ${nomeNivel(m.idioma, m.nivel)}` : "sem nível"}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
