import { useState } from "react";
import { Wand2 } from "lucide-react";
import { supabase, traduzirErro } from "../lib/supabase";
import { IDIOMAS, nomeNivel, useConsulta, type Idioma } from "../lib/dados";
import { CEFR } from "../lib/idiomas";
import { Aviso, Botao } from "./ui";

type Lista = { id: string; titulo: string; descricao: string; nivel: number };

/**
 * Monta as aulas do curso a partir dos exercícios que já existem: cada lista publicada do idioma (nos níveis marcados)
 * vira uma aula, já com o exercício dentro. Pula as listas que já estão em alguma aula deste curso.
 * A professora completa depois: envia o PDF de cada aula e troca o tema, se quiser.
 */
export default function AulasDosExercicios({ curso, aulas, aoCriar }: {
  curso: { id: string; idioma: Idioma; nivel: number };
  aulas: { numero: number; aula_listas: { lista_id: string }[] }[];
  aoCriar: () => void;
}) {
  const { dados: listas } = useConsulta<Lista[]>(() =>
    supabase.from("listas").select("id, titulo, descricao, nivel").eq("idioma", curso.idioma).eq("status", "publicada").order("nivel").order("titulo"),
  [curso.idioma]);
  const [niveis, setNiveis] = useState<Set<number>>(new Set([curso.nivel]));
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState("");

  const jaNoCurso = new Set(aulas.flatMap((a) => a.aula_listas.map((l) => l.lista_id)));
  const livres = (listas ?? []).filter((l) => !jaNoCurso.has(l.id));
  if (livres.length === 0) return null;

  const porNivel = (n: number) => livres.filter((l) => l.nivel === n).length;
  const novas = livres.filter((l) => niveis.has(l.nivel));
  const alternar = (n: number) => {
    const novo = new Set(niveis);
    if (novo.has(n)) novo.delete(n);
    else novo.add(n);
    setNiveis(novo);
  };

  async function criar() {
    if (novas.length === 0) return;
    setErro("");
    setCriando(true);
    const primeiro = Math.max(0, ...aulas.map((a) => a.numero)) + 1;
    const itens = novas.map((lista, i) => ({ lista, idAula: crypto.randomUUID(), numero: primeiro + i }));
    const { error } = await supabase.from("aulas").insert(
      itens.map(({ lista, idAula, numero }) => ({ id: idAula, curso_id: curso.id, numero, titulo: lista.titulo, subtitulo: lista.descricao })),
    );
    if (error) {
      setCriando(false);
      return setErro(traduzirErro(error.message));
    }
    const { error: erroLigacao } = await supabase.from("aula_listas").insert(itens.map(({ lista, idAula }) => ({ aula_id: idAula, lista_id: lista.id, ordem: 0 })));
    setCriando(false);
    if (erroLigacao) return setErro(`As aulas foram criadas, mas os exercícios não entraram: ${traduzirErro(erroLigacao.message)}`);
    aoCriar();
  }

  return (
    <details open={aulas.length === 0} className="group mb-6 rounded-2xl border border-destaque/40 bg-destaque-suave">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-superficie text-marca"><Wand2 className="size-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-marca">Montar aulas com os exercícios que já existem</span>
          <span className="block text-sm text-suave">{livres.length} {livres.length === 1 ? "exercício publicado" : "exercícios publicados"} de {IDIOMAS[curso.idioma]} ainda fora deste curso. Cada um vira uma aula.</span>
        </span>
      </summary>
      <div className="border-t border-destaque/30 p-4">
        <p className="mb-3 text-sm text-suave">Marque os níveis. Cada exercício vira uma aula, já com o exercício dentro. Depois você envia o PDF de cada aula.</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {CEFR.map((c, i) => {
            const n = i + 1;
            const total = porNivel(n);
            const ativo = niveis.has(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => alternar(n)}
                aria-pressed={ativo}
                disabled={total === 0 && !ativo}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition disabled:opacity-40 ${
                  ativo ? "bg-marca text-sobre-marca" : "border border-borda bg-superficie text-suave hover:text-texto"
                }`}
              >
                {c} · {nomeNivel(curso.idioma, n)} ({total})
              </button>
            );
          })}
        </div>
        {novas.length > 0 && (
          <ul className="mb-4 max-h-40 space-y-1 overflow-y-auto rounded-xl bg-superficie p-3 text-sm">
            {novas.map((l, i) => (
              <li key={l.id} className="flex gap-2"><span className="w-6 shrink-0 text-right text-suave">{i + 1}.</span> <span className="truncate">{l.titulo}</span></li>
            ))}
          </ul>
        )}
        {erro && <div className="mb-3"><Aviso>{erro}</Aviso></div>}
        <Botao onClick={criar} carregando={criando} disabled={novas.length === 0}>
          {novas.length === 0 ? "Marque um nível" : `Criar ${novas.length} ${novas.length === 1 ? "aula" : "aulas"}`}
        </Botao>
      </div>
    </details>
  );
}
