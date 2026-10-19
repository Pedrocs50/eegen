import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, CheckCircle2, ClipboardList, Headphones, KeyRound, Lock } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase, traduzirErro } from "../lib/supabase";
import { IDIOMAS, nomeNivel, useConsulta, type Aula, type Curso, type Turma } from "../lib/dados";
import { CabecalhoPagina } from "../componentes/Painel";
import LeitorPdf from "../componentes/LeitorPdf";
import { Aviso, Botao, Cartao, Etiqueta, EstadoVazio, Pontilhado, TextoCarregando } from "../componentes/ui";

type MinhaTurma = {
  turmas: Turma & {
    cursos: Curso;
    professor: { nome: string } | null;
    aulas_liberadas: { aulas: Aula | null }[];
  };
};

function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] || "";
}

function EntrarNaTurma({ aoEntrar, destaque }: { aoEntrar: () => void; destaque: boolean }) {
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const codigo = String(new FormData(formulario).get("codigo")).trim();
    setErro("");
    setEnviando(true);
    const { error } = await supabase.rpc("entrar_na_turma", { codigo_turma: codigo });
    setEnviando(false);
    if (error) setErro(traduzirErro(error.message));
    else {
      formulario.reset();
      aoEntrar();
    }
  }

  return (
    <Cartao className={destaque ? "border-destaque" : ""}>
      <div className="flex items-start gap-4">
        <span className="hidden size-11 shrink-0 place-items-center rounded-xl bg-destaque-suave text-marca sm:grid"><KeyRound className="size-5" /></span>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-marca">Entrar em uma turma</h2>
          <p className="text-sm text-suave">Digite o código de 6 letras que a sua professora enviou.</p>
          <form onSubmit={enviar} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <label htmlFor="codigo" className="sr-only">Código da turma</label>
            <input
              id="codigo"
              name="codigo"
              required
              minLength={6}
              maxLength={6}
              autoComplete="off"
              placeholder="K7Q2PB"
              className="h-12 rounded-xl border border-borda bg-superficie px-4 font-mono text-lg font-bold tracking-[0.3em] uppercase placeholder:font-normal placeholder:tracking-[0.3em] placeholder:text-suave/50 focus:border-destaque focus:outline-none focus:ring-4 focus:ring-destaque-suave sm:w-48"
            />
            <Botao type="submit" carregando={enviando} className="h-12">Entrar na turma</Botao>
          </form>
          {erro && <div className="mt-3"><Aviso>{erro}</Aviso></div>}
        </div>
      </div>
    </Cartao>
  );
}

export function InicioAluno() {
  const { perfil } = useAuth();
  const { dados: matriculas, erro, carregando, recarregar } = useConsulta<MinhaTurma[]>(
    () =>
      supabase
        .from("matriculas")
        .select("turmas(*, cursos(*), professor:perfis!professor_id(nome), aulas_liberadas(aulas(*)))")
        .eq("aluno_id", perfil?.id ?? "")
        .order("criado_em", { ascending: false }),
    [perfil?.id],
  );

  const turmas = (matriculas ?? []).map((m) => m.turmas).filter(Boolean);

  return (
    <>
      <CabecalhoPagina
        etiqueta="Meus estudos"
        titulo={`Olá, ${primeiroNome(perfil?.nome ?? "") || "aluno"}!`}
        descricao="Aqui ficam os seus cursos e as aulas que a sua professora já liberou."
      />

      {erro && <Aviso>{erro}</Aviso>}
      {carregando && <TextoCarregando />}

      {!carregando && (
        <div className="space-y-8">
          {turmas.map((turma) => {
            const aulas = turma.aulas_liberadas
              .map((l) => l.aulas)
              .filter((a): a is Aula => !!a)
              .sort((a, b) => a.numero - b.numero);
            return (
              <section key={turma.id}>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Etiqueta>{IDIOMAS[turma.cursos.idioma]}</Etiqueta>
                      <Etiqueta tom="creme">{nomeNivel(turma.cursos.idioma, turma.cursos.nivel)}</Etiqueta>
                    </div>
                    <h2 className="mt-2 text-2xl font-bold text-marca">{turma.cursos.titulo}</h2>
                    <p className="text-sm text-suave">
                      Turma {turma.nome}
                      {turma.professor?.nome && ` · com ${turma.professor.nome}`}
                    </p>
                  </div>
                </div>
                {aulas.length === 0 ? (
                  <Cartao className="flex items-center gap-3 text-sm text-suave">
                    <Lock className="size-5 shrink-0" /> Nenhuma aula liberada ainda. Assim que a professora liberar, ela aparece aqui.
                  </Cartao>
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {aulas.map((aula) => (
                      <li key={aula.id}>
                        <Link to={`/aulas/${aula.id}`} className="flex h-full gap-4 rounded-2xl border border-borda bg-superficie p-4 transition hover:border-destaque hover:shadow-sm">
                          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-marinho-800 font-serif text-lg font-bold text-white">{aula.numero}</span>
                          <span className="min-w-0">
                            <span className="block font-serif text-lg font-bold text-marca">{aula.titulo}</span>
                            {aula.subtitulo && <span className="mt-0.5 block font-serif text-sm text-suave italic">{aula.subtitulo}</span>}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}

          <EntrarNaTurma aoEntrar={recarregar} destaque={turmas.length === 0} />
        </div>
      )}
    </>
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
        <ArrowLeft className="size-4" /> {equipe ? "Voltar ao curso" : "Meus cursos"}
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
          <EstadoVazio icone={ClipboardList} titulo="Sem exercícios por enquanto" texto="Quando a professora ligar exercícios a esta aula, eles aparecem aqui." />
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
