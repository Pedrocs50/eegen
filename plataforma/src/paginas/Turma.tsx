import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Check, Copy, Lock, Trash2, Unlock, UserMinus, Users } from "lucide-react";
import { supabase, traduzirErro, type Perfil } from "../lib/supabase";
import { IDIOMAS, nomeNivel, useConsulta, type Aula, type Curso, type Turma as TipoTurma } from "../lib/dados";
import { CabecalhoPagina } from "../componentes/Painel";
import { Aviso, Botao, Cartao, Etiqueta, TextoCarregando } from "../componentes/ui";

type TurmaCompleta = TipoTurma & {
  cursos: Curso & { aulas: Aula[] };
  matriculas: { criado_em: string; perfis: Pick<Perfil, "id" | "nome" | "email"> | null }[];
  aulas_liberadas: { aula_id: string }[];
};

export default function Turma() {
  const { id = "" } = useParams();
  const navegar = useNavigate();
  const [erroAcao, setErroAcao] = useState("");
  const [copiado, setCopiado] = useState(false);
  const { dados: turma, erro, carregando, recarregar, setDados } = useConsulta<TurmaCompleta>(
    () =>
      supabase
        .from("turmas")
        .select("*, cursos(*, aulas(*)), matriculas(criado_em, perfis(id, nome, email)), aulas_liberadas(aula_id)")
        .eq("id", id)
        .order("numero", { referencedTable: "cursos.aulas" })
        .single(),
    [id],
  );

  if (carregando) return <TextoCarregando />;
  if (erro || !turma) return <Aviso>{erro || "Turma não encontrada."}</Aviso>;

  turma.cursos.aulas.sort((a, b) => a.numero - b.numero);
  const liberadas = new Set(turma.aulas_liberadas.map((l) => l.aula_id));
  const mensagemConvite = `Olá! Para acessar os exercícios da turma "${turma.nome}" na plataforma UP English, crie sua conta em ${window.location.origin}/cadastro e, em "Meus cursos", digite o código ${turma.codigo}.`;

  async function copiarConvite() {
    try {
      await navigator.clipboard.writeText(mensagemConvite);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setErroAcao("Não foi possível copiar. Selecione o código e copie manualmente.");
    }
  }

  async function alternarAula(aula: Aula) {
    if (!turma) return;
    setErroAcao("");
    const estavaLiberada = liberadas.has(aula.id);
    // Atualiza na hora e desfaz se o banco recusar.
    const novas = estavaLiberada
      ? turma.aulas_liberadas.filter((l) => l.aula_id !== aula.id)
      : [...turma.aulas_liberadas, { aula_id: aula.id }];
    setDados({ ...turma, aulas_liberadas: novas });
    const { error } = estavaLiberada
      ? await supabase.from("aulas_liberadas").delete().eq("turma_id", turma.id).eq("aula_id", aula.id)
      : await supabase.from("aulas_liberadas").insert({ turma_id: turma.id, aula_id: aula.id });
    if (error) {
      setErroAcao(traduzirErro(error.message));
      recarregar();
    }
  }

  async function removerAluno(aluno: Pick<Perfil, "id" | "nome" | "email">) {
    if (!turma || !confirm(`Remover ${aluno.nome || aluno.email} da turma?`)) return;
    const { error } = await supabase.from("matriculas").delete().eq("turma_id", turma.id).eq("aluno_id", aluno.id);
    if (error) setErroAcao(traduzirErro(error.message));
    else recarregar();
  }

  async function alternarAtiva() {
    if (!turma) return;
    const { error } = await supabase.from("turmas").update({ ativa: !turma.ativa }).eq("id", turma.id);
    if (error) setErroAcao(traduzirErro(error.message));
    else recarregar();
  }

  async function apagarTurma() {
    if (!turma || !confirm(`Apagar a turma "${turma.nome}"? Os alunos perdem o acesso às aulas dela.`)) return;
    const { error } = await supabase.from("turmas").delete().eq("id", turma.id);
    if (error) setErroAcao(traduzirErro(error.message));
    else navegar("/turmas", { replace: true });
  }

  const alunos = turma.matriculas.filter((m) => m.perfis);

  return (
    <>
      <Link to="/turmas" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-suave hover:text-texto">
        <ArrowLeft className="size-4" /> Turmas
      </Link>
      <CabecalhoPagina
        etiqueta={`${IDIOMAS[turma.cursos.idioma]} · ${nomeNivel(turma.cursos.idioma, turma.cursos.nivel)}`}
        titulo={turma.nome}
        descricao={`Curso: ${turma.cursos.titulo}`}
        acoes={
          <div className="flex gap-2">
            <Botao variante="secundario" onClick={alternarAtiva}>
              {turma.ativa ? <><Lock className="size-4" /> Encerrar entradas</> : <><Unlock className="size-4" /> Reabrir entradas</>}
            </Botao>
            <Botao variante="fantasma" onClick={apagarTurma} aria-label="Apagar turma" title="Apagar turma"><Trash2 className="size-4" /></Botao>
          </div>
        }
      />

      {erroAcao && <div className="mb-4"><Aviso>{erroAcao}</Aviso></div>}

      <section className="mb-8 flex flex-col gap-5 rounded-2xl bg-marinho-800 p-6 text-white sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="text-[11px] font-bold tracking-[0.14em] text-azul-300 uppercase">Código da turma</p>
          <p className="mt-1 font-mono text-4xl font-bold tracking-[0.3em]">{turma.codigo}</p>
          <p className="mt-2 text-sm text-white/75">
            {turma.ativa
              ? "Envie para os alunos. Eles criam a conta e digitam o código em “Meus cursos”."
              : "Entradas encerradas: o código não aceita novos alunos até você reabrir."}
          </p>
        </div>
        <button onClick={copiarConvite} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-marinho-800 hover:bg-white/90">
          {copiado ? <><Check className="size-4" /> Convite copiado</> : <><Copy className="size-4" /> Copiar convite</>}
        </button>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section>
          <h2 className="text-2xl font-bold text-marca">Aulas</h2>
          <p className="mb-4 text-sm text-suave">{liberadas.size} de {turma.cursos.aulas.length} liberadas. Aluno só vê as aulas liberadas.</p>
          {turma.cursos.aulas.length === 0 ? (
            <Aviso tipo="info">Este curso ainda não tem aulas. <Link to={`/cursos/${turma.curso_id}`} className="font-semibold underline">Adicionar aulas</Link></Aviso>
          ) : (
            <ol className="space-y-2">
              {turma.cursos.aulas.map((aula) => {
                const liberada = liberadas.has(aula.id);
                return (
                  <li key={aula.id} className="flex items-center gap-3 rounded-2xl border border-borda bg-superficie p-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-marinho-800 font-serif font-bold text-white">{aula.numero}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{aula.titulo}</span>
                    <button
                      role="switch"
                      aria-checked={liberada}
                      aria-label={`Liberar aula ${aula.numero}`}
                      onClick={() => alternarAula(aula)}
                      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${
                        liberada ? "bg-sucesso-suave text-sucesso" : "border border-borda text-suave hover:text-texto"
                      }`}
                    >
                      {liberada ? <><Unlock className="size-3.5" /> Liberada</> : <><Lock className="size-3.5" /> Bloqueada</>}
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section>
          <h2 className="text-2xl font-bold text-marca">Alunos</h2>
          <p className="mb-4 text-sm text-suave">{alunos.length} {alunos.length === 1 ? "aluno" : "alunos"} na turma.</p>
          <Cartao className="p-0 sm:p-0">
            {alunos.length === 0 ? (
              <div className="p-6 text-center text-sm text-suave">
                <Users className="mx-auto mb-2 size-6" />
                Ninguém entrou ainda. Copie o convite e envie para os alunos.
              </div>
            ) : (
              <ul className="divide-y divide-borda">
                {alunos.map(({ perfis: aluno, criado_em }) => aluno && (
                  <li key={aluno.id} className="flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{aluno.nome || "Sem nome"}</p>
                      <p className="truncate text-xs text-suave">{aluno.email} · desde {new Date(criado_em).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <Botao variante="fantasma" className="px-3" onClick={() => removerAluno(aluno)} aria-label={`Remover ${aluno.nome || aluno.email}`} title="Remover da turma">
                      <UserMinus className="size-4" />
                    </Botao>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
          {!turma.ativa && <div className="mt-3"><Etiqueta tom="creme">Entradas encerradas</Etiqueta></div>}
        </section>
      </div>
    </>
  );
}
