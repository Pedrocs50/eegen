import { useState } from "react";
import { Link } from "react-router";
import { FileStack } from "lucide-react";
import { supabase, traduzirErro } from "../lib/supabase";
import { IDIOMAS, nomeNivel, useConsulta, type Idioma } from "../lib/dados";
import { CEFR } from "../lib/idiomas";
import { CAMPOS_MATERIAL, ordemNatural, type Material } from "../lib/biblioteca";
import { Aviso, Botao } from "./ui";

/**
 * Monta as aulas do curso a partir da biblioteca: marca os PDFs e cada um vira uma aula (com o título do PDF e o material
 * já ligado). Pula os PDFs que o curso já usa. Os exercícios de cada aula são colocados depois, em cada aula.
 */
export default function AulasDaBiblioteca({ curso, aulas, aoCriar }: {
  curso: { id: string; idioma: Idioma; nivel: number };
  aulas: { numero: number; material_arquivo: string }[];
  aoCriar: () => void;
}) {
  const { dados } = useConsulta<Material[]>(() => supabase.from("materiais").select(CAMPOS_MATERIAL).eq("idioma", curso.idioma), [curso.idioma]);
  // Níveis mostrados: o do curso e os PDFs ainda sem nível (ficam em "pendente" até a professora organizar a biblioteca).
  const [niveis, setNiveis] = useState<Set<number | "sem">>(new Set([curso.nivel, "sem"]));
  const [desmarcados, setDesmarcados] = useState<Set<string>>(new Set());
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState("");

  const jaNoCurso = new Set(aulas.map((a) => a.material_arquivo).filter(Boolean));
  const livres = (dados ?? []).filter((m) => !jaNoCurso.has(m.arquivo));
  const chave = (m: Material): number | "sem" => m.nivel ?? "sem";
  const candidatos = livres.filter((m) => niveis.has(chave(m))).sort((a, b) => ordemNatural(a.titulo, b.titulo));
  const escolhidos = candidatos.filter((m) => !desmarcados.has(m.id));

  const alternarNivel = (n: number | "sem") => {
    const novo = new Set(niveis);
    if (novo.has(n)) novo.delete(n);
    else novo.add(n);
    setNiveis(novo);
  };
  const alternarMaterial = (id: string) => {
    const novo = new Set(desmarcados);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    setDesmarcados(novo);
  };

  if (dados && dados.length === 0) {
    return (
      <p className="mb-6 rounded-2xl border border-dashed border-borda p-4 text-sm text-suave">
        Envie as aulas em PDF para a biblioteca e monte o curso com elas: <Link to="/biblioteca" className="font-semibold text-destaque underline">Biblioteca → Aulas em PDF</Link>.
      </p>
    );
  }
  if (livres.length === 0) return null;

  const contagem = (n: number | "sem") => livres.filter((m) => chave(m) === n).length;

  async function criar() {
    if (escolhidos.length === 0) return;
    setErro("");
    setCriando(true);
    const primeiro = Math.max(0, ...aulas.map((a) => a.numero)) + 1;
    const { error } = await supabase.from("aulas").insert(
      escolhidos.map((m, i) => ({
        curso_id: curso.id,
        numero: primeiro + i,
        titulo: m.titulo,
        material_arquivo: m.arquivo,
        material_nome: m.nome_original || `${m.titulo}.pdf`,
      })),
    );
    setCriando(false);
    if (error) return setErro(traduzirErro(error.message));
    setDesmarcados(new Set());
    aoCriar();
  }

  return (
    <details open={aulas.length === 0} className="mb-6 rounded-2xl border border-destaque/40 bg-destaque-suave">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-superficie text-marca"><FileStack className="size-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-marca">Montar aulas com os PDFs da biblioteca</span>
          <span className="block text-sm text-suave">{livres.length} {livres.length === 1 ? "PDF de" : "PDFs de"} {IDIOMAS[curso.idioma]} ainda fora deste curso. Cada um vira uma aula, na ordem.</span>
        </span>
      </summary>
      <div className="border-t border-destaque/30 p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {CEFR.map((c, i) => {
            const n = i + 1;
            const total = contagem(n);
            const ativo = niveis.has(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => alternarNivel(n)}
                aria-pressed={ativo}
                disabled={total === 0 && !ativo}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition disabled:opacity-40 ${ativo ? "bg-marca text-sobre-marca" : "border border-borda bg-superficie text-suave hover:text-texto"}`}
              >
                {c} · {nomeNivel(curso.idioma, n)} ({total})
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => alternarNivel("sem")}
            aria-pressed={niveis.has("sem")}
            disabled={contagem("sem") === 0 && !niveis.has("sem")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition disabled:opacity-40 ${niveis.has("sem") ? "bg-marca text-sobre-marca" : "border border-borda bg-superficie text-suave hover:text-texto"}`}
          >
            Sem nível ({contagem("sem")})
          </button>
        </div>
        {candidatos.length > 0 ? (
          <ul className="mb-4 max-h-64 space-y-0.5 overflow-y-auto rounded-xl bg-superficie p-2 text-sm">
            {candidatos.map((m) => (
              <li key={m.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-fundo">
                  <input type="checkbox" checked={!desmarcados.has(m.id)} onChange={() => alternarMaterial(m.id)} className="size-4 accent-[var(--c-marca)]" />
                  <span className="w-6 shrink-0 text-right text-suave">{desmarcados.has(m.id) ? "" : `${escolhidos.indexOf(m) + 1}.`}</span>
                  <span className="min-w-0 flex-1 truncate">{m.titulo}</span>
                  {m.nivel === null && <span className="text-xs text-coral">sem nível</span>}
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-sm text-suave">Marque um nível para ver os PDFs.</p>
        )}
        {erro && <div className="mb-3"><Aviso>{erro}</Aviso></div>}
        <Botao onClick={criar} carregando={criando} disabled={escolhidos.length === 0}>
          {escolhidos.length === 0 ? "Marque pelo menos um PDF" : `Criar ${escolhidos.length} ${escolhidos.length === 1 ? "aula" : "aulas"}`}
        </Botao>
        <p className="mt-2 text-xs text-suave">Depois, em cada aula, você coloca os exercícios e ajusta o tema, se quiser.</p>
      </div>
    </details>
  );
}
