import { useState } from "react";
import { Link } from "react-router";
import { ClipboardList, Plus } from "lucide-react";
import { supabase } from "../lib/supabase";
import { IDIOMAS, nomeNivel, useConsulta, type Idioma } from "../lib/dados";
import { ORDEM_IDIOMAS } from "../lib/idiomas";
import { CabecalhoPagina } from "../componentes/Painel";
import CopiarLink from "../componentes/CopiarLink";
import { Aviso, Etiqueta, EstadoVazio, TextoCarregando } from "../componentes/ui";

type ListaResumo = {
  id: string;
  titulo: string;
  tema: string;
  idioma: Idioma;
  nivel: number;
  status: "rascunho" | "publicada";
  atualizado_em: string;
  questoes: { count: number }[];
  aula_listas: { count: number }[];
  turma_listas: { count: number }[];
  curso_listas: { count: number }[];
};

/** Onde a lista está em uso: sem curso, aula nem turma, nenhum aluno a vê. */
function OndeEsta({ cursos, aulas, turmas }: { cursos: number; aulas: number; turmas: number }) {
  if (cursos === 0 && aulas === 0 && turmas === 0) return <span className="text-xs text-suave" title="Coloque nos exercícios de um curso ou nos extras de uma turma para os alunos verem">Fora dos cursos</span>;
  const partes = [
    cursos && `${cursos} ${cursos === 1 ? "curso" : "cursos"}`,
    aulas && `${aulas} ${aulas === 1 ? "aula" : "aulas"}`,
    turmas && `extra em ${turmas} ${turmas === 1 ? "turma" : "turmas"}`,
  ].filter(Boolean);
  return <span className="text-xs text-suave">Em {partes.join(" · ")}</span>;
}

const BOTAO_NOVA = (
  <Link to="/exercicios/nova" className="inline-flex h-11 items-center gap-2 rounded-xl bg-marca px-4 text-sm font-semibold text-sobre-marca hover:bg-marca-hover">
    <Plus className="size-4" /> Nova lista
  </Link>
);

export default function Listas() {
  const [status, setStatus] = useState<"todas" | "rascunho" | "publicada">("todas");
  const [idioma, setIdioma] = useState<Idioma | "todos">("todos");
  const [nivel, setNivel] = useState(0);
  const [soFora, setSoFora] = useState(false);
  const { dados: listas, erro, carregando } = useConsulta<ListaResumo[]>(() =>
    supabase.from("listas").select("id, titulo, tema, idioma, nivel, status, atualizado_em, questoes(count), aula_listas(count), turma_listas(count), curso_listas(count)").order("atualizado_em", { ascending: false }),
  );
  const fora = (l: ListaResumo) => !(l.curso_listas[0]?.count || l.aula_listas[0]?.count || l.turma_listas[0]?.count);
  const visiveis = (listas ?? []).filter(
    (l) => (status === "todas" || l.status === status) && (idioma === "todos" || l.idioma === idioma) && (!nivel || l.nivel === nivel) && (!soFora || fora(l)),
  );
  const pilula = (ativa: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-semibold transition ${ativa ? "bg-marca text-sobre-marca" : "border border-borda bg-superficie text-suave hover:text-texto"}`;

  return (
    <>
      <CabecalhoPagina
        etiqueta="Ensino"
        titulo="Exercícios"
        descricao="O banco de listas da escola. O aluno vê uma lista quando ela está publicada e foi liberada para a turma dele (nos exercícios do curso, numa aula ou nos extras)."
        acoes={listas && listas.length > 0 ? BOTAO_NOVA : undefined}
      />
      {erro && <Aviso>{erro}</Aviso>}
      {carregando && <TextoCarregando />}

      {listas && listas.length === 0 && (
        <EstadoVazio
          icone={ClipboardList}
          titulo="Crie a primeira lista"
          texto="Monte seções com múltipla escolha, verdadeiro ou falso, lacunas e respostas curtas. Depois publique para os alunos."
          acao={BOTAO_NOVA}
        />
      )}

      {listas && listas.length > 0 && (
        <>
          <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filtrar por idioma">
            {(["todos", ...ORDEM_IDIOMAS] as const).map((valor) => (
              <button
                key={valor}
                onClick={() => {
                  setIdioma(valor);
                  setNivel(0);
                }}
                aria-pressed={idioma === valor}
                className={pilula(idioma === valor)}
              >
                {valor === "todos" ? "Todos os idiomas" : IDIOMAS[valor]}
              </button>
            ))}
            {idioma !== "todos" && (
              <label>
                <span className="sr-only">Nível</span>
                <select value={nivel} onChange={(e) => setNivel(Number(e.target.value))} className="h-9 rounded-full border border-borda bg-superficie px-3 text-sm font-semibold">
                  <option value={0}>Todos os níveis</option>
                  {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{nomeNivel(idioma, n)}</option>)}
                </select>
              </label>
            )}
          </div>
          <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filtrar por status">
            {(["todas", "publicada", "rascunho"] as const).map((valor) => (
              <button key={valor} onClick={() => setStatus(valor)} aria-pressed={status === valor} className={pilula(status === valor)}>
                {{ todas: "Todas", publicada: "Publicadas", rascunho: "Rascunhos" }[valor]}
              </button>
            ))}
            <button onClick={() => setSoFora(!soFora)} aria-pressed={soFora} className={pilula(soFora)} title="Listas que nenhum aluno vê ainda: não estão em nenhum curso, aula ou extra">
              Fora dos cursos
            </button>
          </div>
          {visiveis.length === 0 && <p className="text-sm text-suave">Nenhuma lista com esses filtros.</p>}
          <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-superficie">
            {visiveis.map((lista) => (
              <li key={lista.id} className="flex items-center pr-3 transition hover:bg-fundo">
                <Link to={`/exercicios/${lista.id}`} className="flex min-w-0 flex-1 flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-lg font-bold text-marca">{lista.titulo}</p>
                    <p className="text-sm text-suave">
                      {IDIOMAS[lista.idioma]} · {nomeNivel(lista.idioma, lista.nivel)}
                      {lista.tema && ` · ${lista.tema}`}
                    </p>
                  </div>
                  <span className="text-sm text-suave">{lista.questoes[0]?.count ?? 0} questões</span>
                  <OndeEsta cursos={lista.curso_listas[0]?.count ?? 0} aulas={lista.aula_listas[0]?.count ?? 0} turmas={lista.turma_listas[0]?.count ?? 0} />
                  <Etiqueta tom={lista.status === "publicada" ? "verde" : "creme"}>{lista.status === "publicada" ? "Publicada" : "Rascunho"}</Etiqueta>
                </Link>
                <CopiarLink idLista={lista.id} compacto publicada={lista.status === "publicada"} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
