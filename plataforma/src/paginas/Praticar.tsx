import { useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, BookOpen, CheckCircle2, ClipboardList, Headphones, Lightbulb, PenLine, RotateCcw, Search } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase, traduzirErro } from "../lib/supabase";
import { IDIOMAS, nomeNivel, useConsulta, type Idioma } from "../lib/dados";
import { ORDEM_IDIOMAS, CEFR } from "../lib/idiomas";
import { respondida, type Lista, type Questao, type Resposta, type Secao } from "../lib/exercicios";
import { CabecalhoPagina } from "../componentes/Painel";
import QuestaoAluno, { type Correcao } from "../componentes/QuestaoAluno";
import PlayerListening from "../componentes/PlayerListening";
import { Aviso, Botao, Etiqueta, EstadoVazio, Pontilhado, TextoCarregando } from "../componentes/ui";

type ListaDisponivel = {
  id: string;
  titulo: string;
  tema: string;
  descricao: string;
  idioma: Idioma;
  nivel: number;
  questoes: { count: number }[];
  secoes: { tipo_estimulo: string }[];
};
type TentativaResumo = { lista_id: string; nota: number };
type Situacao = "todas" | "pendentes" | "feitas";


function BarraProgresso({ feitas, total, rotulo }: { feitas: number; total: number; rotulo: string }) {
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-borda"
      role="progressbar"
      aria-label={rotulo}
      aria-valuenow={feitas}
      aria-valuemin={0}
      aria-valuemax={total}
    >
      <div className="h-full rounded-full bg-sucesso transition-all" style={{ width: `${total ? (feitas / total) * 100 : 0}%` }} />
    </div>
  );
}

function Pilula({ ativa, onClick, children }: { ativa: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={ativa}
      className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
        ativa ? "bg-marca text-sobre-marca" : "border border-borda bg-superficie text-suave hover:text-texto"
      }`}
    >
      {children}
    </button>
  );
}

function CartaoLista({ lista, nota }: { lista: ListaDisponivel; nota: number | undefined }) {
  const temAudio = lista.secoes.some((s) => s.tipo_estimulo === "audio");
  return (
    <li>
      <Link to={`/praticar/${lista.id}`} className="flex h-full flex-col rounded-2xl border border-borda bg-superficie p-5 transition hover:border-destaque hover:shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {temAudio && <Etiqueta><Headphones className="mr-1 size-3.5" /> Listening</Etiqueta>}
          {nota !== undefined ? (
            <Etiqueta tom="verde"><CheckCircle2 className="mr-1 size-3.5" /> Feita · {nota}%</Etiqueta>
          ) : (
            <Etiqueta tom="creme">Não feita</Etiqueta>
          )}
        </div>
        <h3 className="mt-3 text-lg font-bold text-marca">{lista.titulo}</h3>
        {lista.descricao && <p className="mt-1 font-serif text-sm text-suave italic">{lista.descricao}</p>}
        <p className="mt-auto pt-4 text-sm font-semibold text-destaque">
          {lista.questoes[0]?.count ?? 0} questões · {nota === undefined ? "Começar" : "Refazer"} →
        </p>
      </Link>
    </li>
  );
}

/** Exercícios publicados, organizados por idioma e nível, com filtros e a melhor nota de cada um. */
export function ListasDoAluno() {
  const { perfil } = useAuth();
  const [aba, setAba] = useState<"exercicios" | "aulas">("exercicios");
  const [idioma, setIdioma] = useState<Idioma | "todos">("todos");
  const [nivel, setNivel] = useState<number | "todos">("todos");
  const [situacao, setSituacao] = useState<Situacao>("todas");
  const [busca, setBusca] = useState("");

  const { dados, erro, carregando } = useConsulta<{ listas: ListaDisponivel[]; tentativas: TentativaResumo[] }>(async () => {
    const [listas, tentativas] = await Promise.all([
      supabase
        .from("listas")
        .select("id, titulo, tema, descricao, idioma, nivel, questoes(count), secoes(tipo_estimulo)")
        .eq("status", "publicada")
        .order("nivel")
        .order("titulo"),
      supabase.from("tentativas").select("lista_id, nota").eq("aluno_id", perfil?.id ?? ""),
    ]);
    return { data: { listas: listas.data ?? [], tentativas: tentativas.data ?? [] }, error: listas.error ?? tentativas.error };
  }, [perfil?.id]);

  const melhores = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const t of dados?.tentativas ?? []) mapa.set(t.lista_id, Math.max(mapa.get(t.lista_id) ?? 0, Number(t.nota)));
    return mapa;
  }, [dados]);

  const todas = dados?.listas ?? [];
  const idiomasPresentes = ORDEM_IDIOMAS.filter((i) => todas.some((l) => l.idioma === i));
  const niveisPresentes = [...new Set(todas.filter((l) => idioma === "todos" || l.idioma === idioma).map((l) => l.nivel))].sort((a, b) => a - b);
  const termo = busca.trim().toLowerCase();

  const filtradas = todas.filter(
    (l) =>
      (idioma === "todos" || l.idioma === idioma) &&
      (nivel === "todos" || l.nivel === nivel) &&
      (situacao === "todas" || (situacao === "feitas" ? melhores.has(l.id) : !melhores.has(l.id))) &&
      (!termo || l.titulo.toLowerCase().includes(termo) || l.tema.toLowerCase().includes(termo)),
  );

  // Hierarquia: idioma -> nível -> listas.
  const grupos = ORDEM_IDIOMAS.map((i) => {
    const doIdioma = filtradas.filter((l) => l.idioma === i);
    const niveis = [...new Set(doIdioma.map((l) => l.nivel))].sort((a, b) => a - b);
    return { idioma: i, listas: doIdioma, niveis: niveis.map((n) => ({ nivel: n, listas: doIdioma.filter((l) => l.nivel === n) })) };
  }).filter((g) => g.listas.length > 0);

  const feitasNoTotal = todas.filter((l) => melhores.has(l.id)).length;
  const filtrosAtivos = idioma !== "todos" || nivel !== "todos" || situacao !== "todas" || !!termo;
  const limparFiltros = () => {
    setIdioma("todos");
    setNivel("todos");
    setSituacao("todas");
    setBusca("");
  };

  return (
    <>
      <CabecalhoPagina etiqueta="Hora de praticar!" titulo="Meus estudos" descricao="Responda e veja a correção na hora. Pode refazer quantas vezes quiser: vale a sua melhor nota." />

      <div className="mb-6 flex gap-1 border-b border-borda" role="tablist" aria-label="O que estudar">
        {(
          [
            ["exercicios", "Exercícios", PenLine],
            ["aulas", "Aulas", BookOpen],
          ] as const
        ).map(([valor, rotulo, Icone]) => (
          <button
            key={valor}
            role="tab"
            aria-selected={aba === valor}
            onClick={() => setAba(valor)}
            className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              aba === valor ? "border-marca text-marca" : "border-transparent text-suave hover:text-texto"
            }`}
          >
            <Icone className="size-4" /> {rotulo}
            {valor === "aulas" && <span className="rounded-full bg-creme px-2 py-0.5 text-[10px] font-bold text-suave uppercase">Em breve</span>}
          </button>
        ))}
      </div>

      {aba === "aulas" && (
        <EstadoVazio
          icone={BookOpen}
          titulo="As aulas estão chegando"
          texto="Em breve as aulas da Teacher Monique ficam aqui, com o material em PDF e os exercícios de cada uma."
        />
      )}

      {aba === "exercicios" && (
        <>
          {erro && <Aviso>{erro}</Aviso>}
          {carregando && <TextoCarregando />}

          {!carregando && todas.length === 0 && (
            <EstadoVazio icone={ClipboardList} titulo="Nenhum exercício ainda" texto="Quando a sua professora publicar uma lista, ela aparece aqui." />
          )}

          {todas.length > 0 && (
            <>
              <div className="mb-6 rounded-2xl border border-borda bg-superficie p-5">
                <div className="mb-2 flex items-baseline justify-between text-sm">
                  <span className="font-semibold">Seu progresso geral</span>
                  <span className="text-suave">{feitasNoTotal} de {todas.length} listas feitas</span>
                </div>
                <BarraProgresso feitas={feitasNoTotal} total={todas.length} rotulo="Progresso geral" />
              </div>

              <div className="mb-6 space-y-3">
                {idiomasPresentes.length > 1 && (
                  <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Idioma">
                    <span className="w-20 text-xs font-bold tracking-wide text-suave uppercase">Idioma</span>
                    <Pilula ativa={idioma === "todos"} onClick={() => { setIdioma("todos"); setNivel("todos"); }}>Todos</Pilula>
                    {idiomasPresentes.map((i) => (
                      <Pilula key={i} ativa={idioma === i} onClick={() => { setIdioma(i); setNivel("todos"); }}>{IDIOMAS[i]}</Pilula>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Situação">
                  <span className="w-20 text-xs font-bold tracking-wide text-suave uppercase">Situação</span>
                  <Pilula ativa={situacao === "todas"} onClick={() => setSituacao("todas")}>Todas</Pilula>
                  <Pilula ativa={situacao === "pendentes"} onClick={() => setSituacao("pendentes")}>Não feitas</Pilula>
                  <Pilula ativa={situacao === "feitas"} onClick={() => setSituacao("feitas")}>Feitas</Pilula>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label className="relative flex-1">
                    <span className="sr-only">Buscar exercício</span>
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-suave" aria-hidden="true" />
                    <input
                      type="search"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar por nome ou tema"
                      className="h-11 w-full rounded-xl border border-borda bg-superficie pr-3 pl-9 placeholder:text-suave/70 focus:border-destaque focus:outline-none focus:ring-4 focus:ring-destaque-suave"
                    />
                  </label>
                  <label className="sm:w-64">
                    <span className="sr-only">Nível</span>
                    <select
                      value={nivel}
                      onChange={(e) => setNivel(e.target.value === "todos" ? "todos" : Number(e.target.value))}
                      className="h-11 w-full rounded-xl border border-borda bg-superficie px-3"
                    >
                      <option value="todos">Todos os níveis</option>
                      {niveisPresentes.map((n) => (
                        <option key={n} value={n}>
                          {CEFR[n - 1]}{idioma !== "todos" ? ` · ${nomeNivel(idioma, n)}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              {grupos.length === 0 && (
                <div className="rounded-2xl border-2 border-dashed border-borda p-8 text-center">
                  <p className="text-suave">Nenhum exercício com esses filtros.</p>
                  <Botao variante="secundario" className="mt-3" onClick={limparFiltros}>Limpar filtros</Botao>
                </div>
              )}

              <div className="space-y-10">
                {grupos.map((grupo) => {
                  const doIdioma = todas.filter((l) => l.idioma === grupo.idioma);
                  const feitasIdioma = doIdioma.filter((l) => melhores.has(l.id)).length;
                  return (
                    <section key={grupo.idioma} aria-labelledby={`idioma-${grupo.idioma}`}>
                      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                        <h2 id={`idioma-${grupo.idioma}`} className="text-2xl font-bold text-marca">{IDIOMAS[grupo.idioma]}</h2>
                        <div className="w-full sm:w-64">
                          <p className="mb-1 text-right text-xs text-suave">{feitasIdioma} de {doIdioma.length} feitas</p>
                          <BarraProgresso feitas={feitasIdioma} total={doIdioma.length} rotulo={`Progresso em ${IDIOMAS[grupo.idioma]}`} />
                        </div>
                      </div>
                      <div className="space-y-6 border-l-4 border-creme pl-4 sm:pl-6">
                        {grupo.niveis.map(({ nivel: n, listas }) => {
                          const doNivel = doIdioma.filter((l) => l.nivel === n);
                          const feitasNivel = doNivel.filter((l) => melhores.has(l.id)).length;
                          return (
                            <div key={n}>
                              <h3 className="mb-3 flex flex-wrap items-baseline gap-x-2 text-lg font-bold text-texto">
                                {nomeNivel(grupo.idioma, n)}
                                <span className="text-sm font-semibold text-suave">{CEFR[n - 1]} · {feitasNivel} de {doNivel.length} feitas</span>
                              </h3>
                              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                {listas.map((lista) => <CartaoLista key={lista.id} lista={lista} nota={melhores.get(lista.id)} />)}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
              {filtrosAtivos && grupos.length > 0 && (
                <div className="mt-6 text-center">
                  <button onClick={limparFiltros} className="text-sm font-semibold text-destaque hover:underline">Limpar filtros</button>
                </div>
              )}
            </>
          )}
        </>
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
