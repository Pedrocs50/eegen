import { useState } from "react";
import { Link } from "react-router";
import { ClipboardList, Plus } from "lucide-react";
import { supabase } from "../lib/supabase";
import { IDIOMAS, nomeNivel, useConsulta, type Idioma } from "../lib/dados";
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
};

/** Onde a lista está em uso: sem aula nem turma, nenhum aluno a vê. */
function OndeEsta({ aulas, turmas }: { aulas: number; turmas: number }) {
  if (aulas === 0 && turmas === 0) return <span className="text-xs text-suave" title="Coloque numa aula ou nos extras de uma turma para os alunos verem">Fora das turmas</span>;
  const partes = [aulas && `${aulas} ${aulas === 1 ? "aula" : "aulas"}`, turmas && `extra em ${turmas} ${turmas === 1 ? "turma" : "turmas"}`].filter(Boolean);
  return <span className="text-xs text-suave">Em {partes.join(" · ")}</span>;
}

const BOTAO_NOVA = (
  <Link to="/exercicios/nova" className="inline-flex h-11 items-center gap-2 rounded-xl bg-marca px-4 text-sm font-semibold text-sobre-marca hover:bg-marca-hover">
    <Plus className="size-4" /> Nova lista
  </Link>
);

export default function Listas() {
  const [status, setStatus] = useState<"todas" | "rascunho" | "publicada">("todas");
  const { dados: listas, erro, carregando } = useConsulta<ListaResumo[]>(() =>
    supabase.from("listas").select("id, titulo, tema, idioma, nivel, status, atualizado_em, questoes(count), aula_listas(count), turma_listas(count)").order("atualizado_em", { ascending: false }),
  );
  const visiveis = (listas ?? []).filter((l) => status === "todas" || l.status === status);

  return (
    <>
      <CabecalhoPagina
        etiqueta="Ensino"
        titulo="Exercícios"
        descricao="O banco de listas da escola. O aluno vê uma lista quando ela está publicada e foi colocada numa aula liberada ou nos extras da turma dele."
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
          <div className="mb-5 flex gap-2" role="group" aria-label="Filtrar por status">
            {(["todas", "publicada", "rascunho"] as const).map((valor) => (
              <button
                key={valor}
                onClick={() => setStatus(valor)}
                aria-pressed={status === valor}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  status === valor ? "bg-marca text-sobre-marca" : "border border-borda bg-superficie text-suave hover:text-texto"
                }`}
              >
                {{ todas: "Todas", publicada: "Publicadas", rascunho: "Rascunhos" }[valor]}
              </button>
            ))}
          </div>
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
                  <OndeEsta aulas={lista.aula_listas[0]?.count ?? 0} turmas={lista.turma_listas[0]?.count ?? 0} />
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
