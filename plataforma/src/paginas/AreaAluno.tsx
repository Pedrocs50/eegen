import { Link, useParams } from "react-router";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ClipboardList, FileText, Headphones, Sparkles } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { nomeNivel, useConsulta, type Aula, type Curso } from "../lib/dados";
import { buscarConteudoDaTurma, ehNova, type AulaDaTurma, type ConteudoDaTurma, type ListaDaTurma, type TurmaDoAluno } from "../lib/turmas";
import { CabecalhoPagina } from "../componentes/Painel";
import LeitorPdf from "../componentes/LeitorPdf";
import { BarraProgresso, CartaoLista, EntrarNaTurma, PedidosPendentes, SeletorTurma, descricaoDaTurma, useTurmasDoAluno } from "../componentes/TurmaAluno";
import { Aviso, Etiqueta, EstadoVazio, Pontilhado, TextoCarregando } from "../componentes/ui";

function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] || "";
}

/** "Minha turma": a casa do aluno. Aulas liberadas, o próximo exercício e os extras da turma escolhida. */
export function InicioAluno() {
  const { perfil } = useAuth();
  const { turmas, atual, escolher, erro, carregando, recarregar } = useTurmasDoAluno();
  const equipe = perfil?.papel !== "aluno";

  return (
    <>
      <CabecalhoPagina
        etiqueta={equipe ? "Visão do aluno" : "Minha turma"}
        titulo={equipe ? "Como o aluno vê a turma" : `Olá, ${primeiroNome(perfil?.nome ?? "") || "aluno"}!`}
        descricao={
          equipe
            ? "Escolha uma das suas turmas para ver exatamente o que os alunos dela veem: só as aulas liberadas e os exercícios publicados."
            : "Aqui ficam as aulas que a sua professora já liberou e os exercícios para praticar."
        }
      />
      {erro && <Aviso>{erro}</Aviso>}
      {carregando && <TextoCarregando />}
      {!carregando && (
        <>
          <PedidosPendentes turmas={turmas} />
          {atual ? (
            <>
              <SeletorTurma turmas={turmas} atual={atual} aoEscolher={escolher} />
              <PainelDaTurma turma={atual} />
            </>
          ) : equipe ? (
            <EstadoVazio icone={BookOpen} titulo="Nenhuma turma ainda" texto="Crie uma turma em Turmas para ver como os alunos dela enxergam as aulas e os exercícios." />
          ) : null}
          {!equipe && (
            <div className="mt-10">
              <EntrarNaTurma aoEntrar={recarregar} destaque={turmas.length === 0} />
            </div>
          )}
        </>
      )}
    </>
  );
}

/** Primeira lista ainda não feita: começa pela aula mais recente (é o assunto da semana), depois as anteriores, depois os extras. */
function proximoExercicio(conteudo: ConteudoDaTurma): { lista: ListaDaTurma; aula: AulaDaTurma | null } | null {
  for (const aula of [...conteudo.aulas].reverse()) {
    const lista = aula.listas.find((l) => conteudo.notas[l.id] === undefined);
    if (lista) return { lista, aula };
  }
  const extra = conteudo.extras.find((l) => conteudo.notas[l.id] === undefined);
  return extra ? { lista: extra, aula: null } : null;
}

function PainelDaTurma({ turma }: { turma: TurmaDoAluno }) {
  const { perfil } = useAuth();
  const { dados, erro, carregando } = useConsulta<ConteudoDaTurma>(() => buscarConteudoDaTurma(turma.id, perfil?.id ?? ""), [turma.id, perfil?.id]);

  if (carregando && !dados) return <TextoCarregando />;
  if (erro || !dados) return <Aviso>{erro || "Não foi possível abrir a turma."}</Aviso>;

  const ids = [...new Set([...dados.aulas.flatMap((a) => a.listas.map((l) => l.id)), ...dados.extras.map((l) => l.id)])];
  const feitas = ids.filter((id) => dados.notas[id] !== undefined).length;
  const proximo = proximoExercicio(dados);
  const aulasRecentes = [...dados.aulas].reverse();

  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-3xl bg-marinho-800 px-6 py-8 text-white sm:px-10">
        <p className="text-[11px] font-bold tracking-[0.14em] text-azul-300 uppercase">{descricaoDaTurma(turma)}</p>
        <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{turma.nome}</h2>
        {turma.curso && <p className="mt-1 font-serif text-lg text-azul-300 italic">{turma.curso.titulo}</p>}
        <Pontilhado className="mt-6 max-w-xl text-white/80" />
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <div>
            <p className="font-serif text-3xl font-bold">{dados.aulas.length}</p>
            <p className="text-sm text-white/75">{dados.aulas.length === 1 ? "aula liberada" : "aulas liberadas"}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="font-serif text-3xl font-bold">{feitas} <span className="text-lg font-normal text-white/75">de {ids.length} exercícios feitos</span></p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20" aria-hidden="true">
              <div className="h-full rounded-full bg-azul-300" style={{ width: `${ids.length ? (feitas / ids.length) * 100 : 0}%` }} />
            </div>
          </div>
        </div>
      </section>

      {proximo && (
        <Link
          to={`/praticar/${proximo.lista.id}`}
          className="flex flex-wrap items-center gap-4 rounded-2xl border-2 border-destaque bg-destaque-suave p-5 transition hover:shadow-sm"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-marca text-sobre-marca"><Sparkles className="size-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold tracking-[0.12em] text-destaque uppercase">Próximo exercício</span>
            <span className="block font-serif text-xl font-bold text-marca">{proximo.lista.titulo}</span>
            <span className="text-sm text-suave">{proximo.aula ? `Aula ${proximo.aula.numero} · ${proximo.aula.titulo}` : "Exercício extra da turma"}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-marca">Começar <ArrowRight className="size-4" /></span>
        </Link>
      )}

      <section aria-labelledby="titulo-aulas">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="titulo-aulas" className="text-2xl font-bold text-marca">Aulas</h2>
            <p className="text-sm text-suave">Da mais recente para a primeira. Cada aula tem o material e os exercícios dela.</p>
          </div>
        </div>
        {aulasRecentes.length === 0 ? (
          <EstadoVazio icone={BookOpen} titulo="Nenhuma aula liberada ainda" texto="Assim que a professora liberar a primeira aula, ela aparece aqui com o material e os exercícios." />
        ) : (
          <ul className="space-y-3">
            {aulasRecentes.map((aula) => {
              const feitasAula = aula.listas.filter((l) => dados.notas[l.id] !== undefined).length;
              const completa = aula.listas.length > 0 && feitasAula === aula.listas.length;
              return (
                <li key={aula.id}>
                  <Link to={`/aulas/${aula.id}`} className="flex flex-wrap items-center gap-4 rounded-2xl border border-borda bg-superficie p-4 transition hover:border-destaque hover:shadow-sm sm:flex-nowrap sm:p-5">
                    <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-marinho-800 font-serif text-lg font-bold text-white">{aula.numero}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-serif text-lg font-bold text-marca">{aula.titulo}</span>
                        {ehNova(aula.liberadaEm) && <Etiqueta tom="coral">Nova</Etiqueta>}
                      </span>
                      {aula.subtitulo && <span className="block font-serif text-sm text-suave italic">{aula.subtitulo}</span>}
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {aula.temMaterial && <Etiqueta><FileText className="mr-1 size-3.5" /> Material</Etiqueta>}
                        {aula.listas.length > 0 && (
                          <Etiqueta tom={completa ? "verde" : "creme"}>
                            {completa ? <CheckCircle2 className="mr-1 size-3.5" /> : <ClipboardList className="mr-1 size-3.5" />}
                            {feitasAula} de {aula.listas.length} {aula.listas.length === 1 ? "exercício" : "exercícios"}
                          </Etiqueta>
                        )}
                        {aula.listas.some((l) => l.secoes.some((s) => s.tipo_estimulo === "audio")) && <Etiqueta><Headphones className="mr-1 size-3.5" /> Listening</Etiqueta>}
                      </span>
                    </span>
                    <span className="hidden items-center gap-1 text-sm font-semibold text-destaque sm:inline-flex">Abrir aula <ArrowRight className="size-4" /></span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {dados.extras.length > 0 && (
        <section aria-labelledby="titulo-extras">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="titulo-extras" className="text-2xl font-bold text-marca">Exercícios extras</h2>
              <p className="text-sm text-suave">Para praticar além das aulas. {dados.extras.filter((l) => dados.notas[l.id] !== undefined).length} de {dados.extras.length} feitos.</p>
            </div>
            <Link to={`/praticar?turma=${turma.id}&aba=extras`} className="inline-flex items-center gap-1 text-sm font-semibold text-destaque hover:underline">
              Ver todos <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="mb-4"><BarraProgresso feitas={dados.extras.filter((l) => dados.notas[l.id] !== undefined).length} total={dados.extras.length} rotulo="Progresso nos extras" /></div>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {dados.extras.slice(0, 3).map((l) => (
              <CartaoLista key={l.id} lista={l} nota={dados.notas[l.id]} contexto={ehNova(l.liberadaEm) ? <Etiqueta tom="coral">Novo</Etiqueta> : undefined} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

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
      <Link to={equipe ? `/cursos/${aula.curso_id}` : "/aluno"} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-suave hover:text-texto">
        <ArrowLeft className="size-4" /> {equipe ? "Voltar ao curso" : "Minha turma"}
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
                  <Link to={`/praticar/${lista.id}`} className="flex h-full gap-4 rounded-2xl border border-borda bg-superficie p-5 transition hover:border-destaque hover:shadow-sm">
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
