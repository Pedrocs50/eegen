import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ArrowLeft, BookOpen, ClipboardList, Lightbulb, RotateCcw, Search, Sparkles } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase, traduzirErro } from "../lib/supabase";
import { IDIOMAS, nomeNivel, useConsulta } from "../lib/dados";
import { respondida, type Lista, type Questao, type Resposta, type Secao } from "../lib/exercicios";
import { CabecalhoPagina } from "../componentes/Painel";
import { BarraProgresso, CartaoLista, PedidosPendentes, Pilula, SeletorTurma, useTurmasDoAluno } from "../componentes/TurmaAluno";
import { buscarConteudoDaTurma, ehNova, type ConteudoDaTurma, type ListaDaTurma, type TurmaDoAluno } from "../lib/turmas";
import QuestaoAluno, { type Correcao } from "../componentes/QuestaoAluno";
import PlayerListening from "../componentes/PlayerListening";
import { Aviso, Botao, Etiqueta, EstadoVazio, Pontilhado, TextoCarregando } from "../componentes/ui";

type Situacao = "todas" | "pendentes" | "feitas";
type Aba = "aulas" | "extras";

/** Exercícios da turma, separados entre os das aulas (agrupados por aula) e os extras, com filtro de situação e busca. */
export function ListasDoAluno() {
  const { perfil } = useAuth();
  const { turmas, atual, escolher, erro, carregando } = useTurmasDoAluno();
  const equipe = perfil?.papel !== "aluno";

  return (
    <>
      <CabecalhoPagina
        etiqueta={equipe ? "Visão do aluno" : "Meus estudos"}
        titulo="Exercícios"
        descricao="Responda e veja a correção na hora. Pode refazer quantas vezes quiser: vale a sua melhor nota."
      />
      {erro && <Aviso>{erro}</Aviso>}
      {carregando && <TextoCarregando />}
      {!carregando && (
        <>
          <PedidosPendentes turmas={turmas} />
          {atual ? (
            <>
              <SeletorTurma turmas={turmas} atual={atual} aoEscolher={escolher} />
              <ExerciciosDaTurma turma={atual} />
            </>
          ) : (
            <EstadoVazio
              icone={ClipboardList}
              titulo={equipe ? "Nenhuma turma ainda" : turmas.length ? "Aguardando aprovação" : "Você ainda não está numa turma"}
              texto={
                equipe
                  ? "Crie uma turma para ver os exercícios como os alunos dela veem."
                  : turmas.length
                    ? "Assim que a professora aprovar a sua entrada, os exercícios da turma aparecem aqui."
                    : "Os exercícios são liberados por turma. Entre com o código que a sua professora enviou."
              }
              acao={!equipe && turmas.length === 0 ? <Link to="/aluno" className="font-semibold text-destaque underline">Entrar numa turma</Link> : undefined}
            />
          )}
        </>
      )}
    </>
  );
}

function ExerciciosDaTurma({ turma }: { turma: TurmaDoAluno }) {
  const { perfil } = useAuth();
  const [parametros, setParametros] = useSearchParams();
  const aba: Aba = parametros.get("aba") === "extras" ? "extras" : "aulas";
  const [situacao, setSituacao] = useState<Situacao>("todas");
  const [busca, setBusca] = useState("");
  const { dados, erro, carregando } = useConsulta<ConteudoDaTurma>(() => buscarConteudoDaTurma(turma.id, perfil?.id ?? ""), [turma.id, perfil?.id]);

  if (carregando && !dados) return <TextoCarregando />;
  if (erro || !dados) return <Aviso>{erro || "Não foi possível abrir os exercícios."}</Aviso>;

  const mudarAba = (nova: Aba) => {
    const novos = new URLSearchParams(parametros);
    novos.set("aba", nova);
    setParametros(novos, { replace: true });
  };
  const termo = busca.trim().toLowerCase();
  const passa = (l: ListaDaTurma) =>
    (situacao === "todas" || (situacao === "feitas" ? dados.notas[l.id] !== undefined : dados.notas[l.id] === undefined)) &&
    (!termo || `${l.titulo} ${l.descricao}`.toLowerCase().includes(termo));

  const listasDasAulas = dados.aulas.flatMap((a) => a.listas);
  const doTotal = aba === "aulas" ? listasDasAulas : dados.extras;
  const feitas = doTotal.filter((l) => dados.notas[l.id] !== undefined).length;
  const aulas = [...dados.aulas].reverse().map((a) => ({ ...a, visiveis: a.listas.filter(passa) })).filter((a) => a.visiveis.length > 0);
  const extras = dados.extras.filter(passa);
  const nadaComFiltro = aba === "aulas" ? aulas.length === 0 : extras.length === 0;

  return (
    <>
      <div className="mb-6 flex gap-1 border-b border-borda" role="tablist">
        {([
          ["aulas", "Das aulas", BookOpen, listasDasAulas.length],
          ["extras", "Extras", Sparkles, dados.extras.length],
        ] as const).map(([valor, rotulo, Icone, quantidade]) => (
          <button
            key={valor}
            role="tab"
            aria-selected={aba === valor}
            onClick={() => mudarAba(valor)}
            className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              aba === valor ? "border-marca text-marca" : "border-transparent text-suave hover:text-texto"
            }`}
          >
            <Icone className="size-4" /> {rotulo}
            <span className="rounded-full bg-creme px-2 py-0.5 text-xs text-suave">{quantidade}</span>
          </button>
        ))}
      </div>

      {doTotal.length > 0 && (
        <div className="mb-6 rounded-2xl border border-borda bg-superficie p-5">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold">{aba === "aulas" ? "Exercícios das aulas" : "Exercícios extras"}</span>
            <span className="text-suave">{feitas} de {doTotal.length} feitos</span>
          </div>
          <BarraProgresso feitas={feitas} total={doTotal.length} rotulo="Progresso" />
        </div>
      )}

      {doTotal.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2">
            <Pilula ativa={situacao === "todas"} onClick={() => setSituacao("todas")}>Todos</Pilula>
            <Pilula ativa={situacao === "pendentes"} onClick={() => setSituacao("pendentes")}>Não feitos</Pilula>
            <Pilula ativa={situacao === "feitas"} onClick={() => setSituacao("feitas")}>Feitos</Pilula>
          </div>
          <label className="relative flex-1">
            <span className="sr-only">Buscar exercício</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-suave" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome"
              className="h-10 w-full rounded-xl border border-borda bg-superficie pr-3 pl-9 text-sm focus:border-destaque focus:outline-none"
            />
          </label>
        </div>
      )}

      {doTotal.length === 0 ? (
        <EstadoVazio
          icone={aba === "aulas" ? BookOpen : Sparkles}
          titulo={aba === "aulas" ? "Nenhum exercício de aula ainda" : "Nenhum exercício extra ainda"}
          texto={aba === "aulas" ? "Os exercícios aparecem aqui quando a professora libera as aulas." : "Quando a professora liberar exercícios extras para a turma, eles aparecem aqui."}
        />
      ) : nadaComFiltro ? (
        <p className="text-sm text-suave">Nenhum exercício com esses filtros.</p>
      ) : aba === "aulas" ? (
        <div className="space-y-8">
          {aulas.map((aula) => (
            <section key={aula.id} aria-labelledby={`aula-${aula.id}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 id={`aula-${aula.id}`} className="flex items-center gap-3 text-lg font-bold text-marca">
                  <span className="grid size-9 place-items-center rounded-lg bg-marinho-800 font-serif text-white">{aula.numero}</span>
                  {aula.titulo}
                  {ehNova(aula.liberadaEm) && <Etiqueta tom="coral">Nova</Etiqueta>}
                </h2>
                <span className="flex items-center gap-3 text-sm">
                  <span className="text-suave">{aula.listas.filter((l) => dados.notas[l.id] !== undefined).length} de {aula.listas.length} feitos</span>
                  <Link to={`/aulas/${aula.id}`} className="font-semibold text-destaque hover:underline">Abrir aula →</Link>
                </span>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {aula.visiveis.map((l) => <CartaoLista key={l.id} lista={l} nota={dados.notas[l.id]} />)}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {extras.map((l) => <CartaoLista key={l.id} lista={l} nota={dados.notas[l.id]} contexto={ehNova(l.liberadaEm) ? <Etiqueta tom="coral">Novo</Etiqueta> : undefined} />)}
        </ul>
      )}
    </>
  );
}

type QuestaoAluno_ = Omit<Questao, "gabarito" | "explicacao"> & { ordem: number };
type ListaParaResponder = Omit<Lista, "secoes"> & { secoes: (Omit<Secao, "questoes"> & { ordem: number; questoes: QuestaoAluno_[] })[] };
type Resultado = { nota: number; acertos: number; total: number; questoes: Record<string, Correcao> };

/** Tela de responder uma lista, com a correção depois do envio. */
export function ResponderLista() {
  const { id = "" } = useParams();
  const { perfil } = useAuth();
  const [respostas, setRespostas] = useState<Record<string, Resposta>>({});
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState("");
  const { dados: lista, erro, carregando } = useConsulta<ListaParaResponder>(
    () =>
      supabase
        .from("listas")
        .select("id, titulo, tema, descricao, idioma, nivel, status, secoes(id, ordem, titulo, instrucao, tipo_estimulo, estimulo, questoes(id, ordem, formato, habilidade, enunciado, conteudo, pontos))")
        .eq("id", id)
        .single(),
    [id],
  );

  const secoes = useMemo(
    () =>
      [...(lista?.secoes ?? [])]
        .sort((a, b) => a.ordem - b.ordem)
        .map((s) => ({ ...s, questoes: [...s.questoes].sort((a, b) => a.ordem - b.ordem) })),
    [lista],
  );
  const todas = secoes.flatMap((s) => s.questoes);

  if (carregando) return <TextoCarregando />;
  if (erro || !lista) return <Aviso>{erro ? "Essa lista não está disponível." : "Lista não encontrada."}</Aviso>;

  const pendentes = todas.filter((q) => !respondida(q, respostas[q.id])).length;
  const voltarPara = perfil?.papel === "aluno" ? "/praticar" : `/exercicios/${lista.id}`;

  async function enviar() {
    if (pendentes > 0 && !confirm(`Você deixou ${pendentes} ${pendentes === 1 ? "questão" : "questões"} sem resposta. Enviar mesmo assim?`)) return;
    setErroEnvio("");
    setEnviando(true);
    const { data, error } = await supabase.rpc("enviar_tentativa", { id_lista: lista!.id, respostas });
    setEnviando(false);
    if (error) setErroEnvio(traduzirErro(error.message));
    else {
      setResultado(data as Resultado);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function refazer() {
    setRespostas({});
    setResultado(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  let numero = 0;

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <Link to={voltarPara} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-suave hover:text-texto">
        <ArrowLeft className="size-4" /> {perfil?.papel === "aluno" ? "Exercícios" : "Voltar ao editor"}
      </Link>

      <header className="rounded-3xl bg-marinho-800 px-6 py-8 text-white sm:px-10">
        <p className="text-[11px] font-bold tracking-[0.14em] text-azul-300 uppercase">
          {IDIOMAS[lista.idioma]} · {nomeNivel(lista.idioma, lista.nivel)}
          {lista.status === "rascunho" && " · rascunho (só a equipe vê)"}
        </p>
        <Pontilhado className="mt-5 text-white/90" />
        <p className="mt-3 font-serif text-xl font-bold sm:text-2xl">HORA DE PRATICAR!</p>
        <h1 className="text-3xl font-bold sm:text-4xl">{lista.titulo}</h1>
        <Pontilhado className="mt-4 text-white/90" />
        {lista.descricao && <p className="mt-4 font-serif text-lg text-azul-300 italic">{lista.descricao}</p>}
      </header>

      {resultado && (
        <section className="mt-6 flex flex-col items-center gap-4 rounded-2xl border border-borda bg-superficie p-6 text-center sm:flex-row sm:text-left" aria-live="polite">
          <div className="grid size-24 shrink-0 place-items-center rounded-full bg-destaque-suave">
            <span className="font-serif text-3xl font-bold text-marca">{resultado.nota}%</span>
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-marca">
              {resultado.nota >= 90 ? "Excelente!" : resultado.nota >= 70 ? "Muito bem!" : resultado.nota >= 50 ? "Bom caminho!" : "Vamos revisar?"}
            </h2>
            <p className="text-suave">Você acertou {resultado.acertos} de {resultado.total} questões. Confira as correções e as dicas abaixo.</p>
          </div>
          <Botao variante="secundario" onClick={refazer}><RotateCcw className="size-4" /> Refazer</Botao>
        </section>
      )}

      <div className="mt-6 space-y-8">
        {secoes.map((secao) => (
          <section key={secao.id}>
            {secao.titulo && <h2 className="text-2xl font-bold text-marca">{secao.titulo}</h2>}
            {secao.instrucao && <p className="mt-1 text-suave">{secao.instrucao}</p>}

            {secao.tipo_estimulo === "texto" && secao.estimulo.texto && (
              <div className="mt-4 rounded-xl border-l-4 border-marca bg-creme p-5 leading-relaxed whitespace-pre-line">{secao.estimulo.texto}</div>
            )}
            {secao.tipo_estimulo === "audio" && <PlayerListening estimulo={secao.estimulo} enviado={!!resultado} />}
            {secao.tipo_estimulo === "dica" && secao.estimulo.texto && (
              <div className="mt-4 flex gap-3 rounded-2xl bg-coral-suave p-5">
                <Lightbulb className="size-6 shrink-0 text-coral" aria-hidden="true" />
                <div>
                  <p className="font-bold text-coral">Dica</p>
                  <p className="mt-1 whitespace-pre-line">{secao.estimulo.texto}</p>
                </div>
              </div>
            )}

            <div className="mt-4 space-y-3">
              {secao.questoes.map((q) => {
                numero += 1;
                return (
                  <QuestaoAluno
                    key={q.id}
                    numero={numero}
                    questao={q}
                    resposta={respostas[q.id]}
                    aoResponder={(r) => setRespostas((atual) => ({ ...atual, [q.id]: r }))}
                    correcao={resultado?.questoes[q.id]}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {erroEnvio && <div className="mt-6"><Aviso>{erroEnvio}</Aviso></div>}

      {!resultado && todas.length > 0 && (
        <div className="mt-8 flex flex-col items-center gap-2">
          <Botao onClick={enviar} carregando={enviando} className="h-12 px-8 text-base">Enviar respostas</Botao>
          <p className="text-sm text-suave">{pendentes === 0 ? "Tudo respondido." : `${todas.length - pendentes} de ${todas.length} respondidas.`}</p>
        </div>
      )}
    </div>
  );
}
