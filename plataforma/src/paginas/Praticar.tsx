import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, CheckCircle2, ClipboardList, Lightbulb, RotateCcw } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase, traduzirErro } from "../lib/supabase";
import { IDIOMAS, nomeNivel, useConsulta, type Idioma } from "../lib/dados";
import { respondida, type Lista, type Questao, type Resposta, type Secao } from "../lib/exercicios";
import { CabecalhoPagina } from "../componentes/Painel";
import QuestaoAluno, { type Correcao } from "../componentes/QuestaoAluno";
import { Aviso, Botao, Etiqueta, EstadoVazio, Pontilhado, TextoCarregando } from "../componentes/ui";

type ListaDisponivel = { id: string; titulo: string; tema: string; descricao: string; idioma: Idioma; nivel: number; questoes: { count: number }[] };
type TentativaResumo = { lista_id: string; nota: number };

/** Exercícios publicados, com a melhor nota de cada um. */
export function ListasDoAluno() {
  const { perfil } = useAuth();
  const { dados, erro, carregando } = useConsulta<{ listas: ListaDisponivel[]; tentativas: TentativaResumo[] }>(async () => {
    const [listas, tentativas] = await Promise.all([
      supabase.from("listas").select("id, titulo, tema, descricao, idioma, nivel, questoes(count)").eq("status", "publicada").order("idioma").order("nivel").order("titulo"),
      supabase.from("tentativas").select("lista_id, nota").eq("aluno_id", perfil?.id ?? ""),
    ]);
    return { data: { listas: listas.data ?? [], tentativas: tentativas.data ?? [] }, error: listas.error ?? tentativas.error };
  }, [perfil?.id]);

  const melhores = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const t of dados?.tentativas ?? []) mapa.set(t.lista_id, Math.max(mapa.get(t.lista_id) ?? 0, Number(t.nota)));
    return mapa;
  }, [dados]);

  const listas = dados?.listas ?? [];
  const feitas = listas.filter((l) => melhores.has(l.id)).length;

  return (
    <>
      <CabecalhoPagina etiqueta="Hora de praticar!" titulo="Exercícios" descricao="Responda e veja a correção na hora. Pode refazer quantas vezes quiser: vale a sua melhor nota." />
      {erro && <Aviso>{erro}</Aviso>}
      {carregando && <TextoCarregando />}

      {!carregando && listas.length === 0 && (
        <EstadoVazio icone={ClipboardList} titulo="Nenhum exercício ainda" texto="Quando a sua professora publicar uma lista, ela aparece aqui." />
      )}

      {listas.length > 0 && (
        <>
          <div className="mb-6 rounded-2xl border border-borda bg-superficie p-5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold">Seu progresso</span>
              <span className="text-suave">{feitas} de {listas.length} listas feitas</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-fundo" role="progressbar" aria-valuenow={feitas} aria-valuemin={0} aria-valuemax={listas.length}>
              <div className="h-full rounded-full bg-sucesso transition-all" style={{ width: `${(feitas / listas.length) * 100}%` }} />
            </div>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {listas.map((lista) => {
              const nota = melhores.get(lista.id);
              return (
                <li key={lista.id}>
                  <Link to={`/praticar/${lista.id}`} className="flex h-full flex-col rounded-2xl border border-borda bg-superficie p-5 transition hover:border-destaque hover:shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Etiqueta>{IDIOMAS[lista.idioma]} · {nomeNivel(lista.idioma, lista.nivel)}</Etiqueta>
                      {nota !== undefined && <Etiqueta tom="verde"><CheckCircle2 className="mr-1 size-3.5" /> {nota}%</Etiqueta>}
                    </div>
                    <h2 className="mt-4 text-xl font-bold text-marca">{lista.titulo}</h2>
                    {lista.descricao && <p className="mt-1 font-serif text-sm text-suave italic">{lista.descricao}</p>}
                    <p className="mt-auto pt-4 text-sm font-semibold text-destaque">
                      {lista.questoes[0]?.count ?? 0} questões · {nota === undefined ? "Começar" : "Refazer"} →
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
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
