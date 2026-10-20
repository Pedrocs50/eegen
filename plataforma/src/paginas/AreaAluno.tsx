import { Link, useParams, useSearchParams } from "react-router";
import { ArrowLeft, CheckCircle2, ClipboardList, Headphones } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { nomeNivel, useConsulta, type Aula, type Curso } from "../lib/dados";
import LeitorPdf from "../componentes/LeitorPdf";
import { Aviso, Etiqueta, EstadoVazio, Pontilhado, TextoCarregando } from "../componentes/ui";

type ListaDaAula = { id: string; titulo: string; descricao: string; status: "rascunho" | "publicada"; questoes: { count: number }[]; secoes: { tipo_estimulo: string }[] };
type AulaComCurso = Aula & {
  cursos: Pick<Curso, "titulo" | "idioma" | "nivel">;
  aula_listas: { ordem: number; listas: ListaDaAula | null }[];
};
type AulaComNotas = { aula: AulaComCurso; notas: Record<string, number> };

/** Página da aula: capa no padrão dos materiais, o PDF dentro do site e os exercícios da aula no fim. */
export function AulaAluno() {
  const { id = "" } = useParams();
  const { perfil } = useAuth();
  const equipe = perfil?.papel === "admin" || perfil?.papel === "professor";
  // Veio da página de uma turma? Então volta para ela (e os exercícios levam a turma junto).
  const idTurma = useSearchParams()[0].get("turma");
  const { dados, erro, carregando } = useConsulta<AulaComNotas>(async () => {
    const resposta = await supabase
      .from("aulas")
      .select("*, cursos(titulo, idioma, nivel), aula_listas(ordem, listas(id, titulo, descricao, status, questoes(count), secoes(tipo_estimulo)))")
      .eq("id", id)
      .single();
    if (resposta.error || !resposta.data) return { data: null, error: resposta.error };
    const aula = resposta.data as unknown as AulaComCurso;
    const ids = aula.aula_listas.map((l) => l.listas?.id).filter((x): x is string => !!x);
    const notas: Record<string, number> = {};
    if (ids.length && perfil?.id) {
      const { data: tentativas } = await supabase.from("tentativas").select("lista_id, nota").eq("aluno_id", perfil.id).in("lista_id", ids);
      for (const t of tentativas ?? []) notas[t.lista_id] = Math.max(notas[t.lista_id] ?? 0, Number(t.nota));
    }
    return { data: { aula, notas }, error: null };
  }, [id, perfil?.id]);

  if (carregando) return <TextoCarregando />;
  if (erro || !dados) return <Aviso>{erro ? "Essa aula não está liberada para você." : "Aula não encontrada."}</Aviso>;
  const { aula, notas } = dados;

  // O aluno só recebe as listas publicadas (as regras do banco escondem rascunhos); a equipe vê todas, marcadas.
  const listas = [...aula.aula_listas]
    .sort((a, b) => a.ordem - b.ordem)
    .map((l) => l.listas)
    .filter((l): l is ListaDaAula => !!l && (equipe || l.status === "publicada"));

  return (
    <>
      <Link
        to={idTurma ? `/aluno/turmas/${idTurma}?aba=aulas` : equipe ? `/cursos/${aula.curso_id}` : "/aluno"}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-suave hover:text-texto"
      >
        <ArrowLeft className="size-4" /> {idTurma ? "Voltar às aulas da turma" : equipe ? "Voltar ao curso" : "Minhas turmas"}
      </Link>
      {equipe && (
        <div className="mb-4">
          <Aviso tipo="info">Você está vendo a aula como o aluno vê. Rascunhos aparecem marcados só para a equipe.</Aviso>
        </div>
      )}

      <section className="overflow-hidden rounded-3xl bg-marinho-800 px-6 py-10 text-white sm:px-12">
        <p className="text-[11px] font-bold tracking-[0.14em] text-azul-300 uppercase">
          {aula.cursos.titulo} · {nomeNivel(aula.cursos.idioma, aula.cursos.nivel)} · Aula {aula.numero}
        </p>
        <Pontilhado className="mt-6 max-w-xl text-white/90" />
        <h1 className="mt-4 text-4xl font-bold sm:text-5xl">{aula.titulo}</h1>
        {aula.subtitulo && <p className="mt-2 font-serif text-xl text-azul-300 italic">{aula.subtitulo}</p>}
        <Pontilhado className="mt-6 max-w-xl text-white/90" />
      </section>

      <div className="mt-8">
        <LeitorPdf aula={aula} />
      </div>

      <section className="mt-10" aria-labelledby="hora-de-praticar">
        <h2 id="hora-de-praticar" className="text-2xl font-bold text-marca">Hora de praticar!</h2>
        <p className="mb-4 text-suave">Depois de estudar o material, faça os exercícios desta aula. Vale a sua melhor nota.</p>
        {listas.length === 0 ? (
          <EstadoVazio
            icone={ClipboardList}
            titulo="Sem exercícios por enquanto"
            texto="Quando a professora ligar exercícios a esta aula, eles aparecem aqui."
            acao={equipe ? <Link to={`/exercicios/nova?aula=${aula.id}`} className="font-semibold text-destaque underline">Criar exercício para esta aula</Link> : undefined}
          />
        ) : (
          <ol className="grid gap-4 sm:grid-cols-2">
            {listas.map((lista, i) => {
              const nota = notas[lista.id];
              const temAudio = lista.secoes.some((s) => s.tipo_estimulo === "audio");
              return (
                <li key={lista.id}>
                  <Link to={`/praticar/${lista.id}${idTurma ? `?turma=${idTurma}` : ""}`} className="flex h-full gap-4 rounded-2xl border border-borda bg-superficie p-5 transition hover:border-destaque hover:shadow-sm">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-marinho-800 font-serif font-bold text-white">{i + 1}</span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex flex-wrap gap-1.5">
                        {temAudio && <Etiqueta><Headphones className="mr-1 size-3.5" /> Listening</Etiqueta>}
                        {nota !== undefined ? <Etiqueta tom="verde"><CheckCircle2 className="mr-1 size-3.5" /> Feita · {nota}%</Etiqueta> : <Etiqueta tom="creme">Não feita</Etiqueta>}
                        {lista.status === "rascunho" && <Etiqueta tom="coral">Rascunho</Etiqueta>}
                      </span>
                      <span className="mt-2 font-serif text-lg font-bold text-marca">{lista.titulo}</span>
                      {lista.descricao && <span className="mt-0.5 font-serif text-sm text-suave italic">{lista.descricao}</span>}
                      <span className="mt-auto pt-3 text-sm font-semibold text-destaque">
                        {lista.questoes[0]?.count ?? 0} questões · {nota === undefined ? "Começar" : "Refazer"} →
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </>
  );
}
