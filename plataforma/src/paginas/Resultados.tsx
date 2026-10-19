import { useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import {
  AlertTriangle, ArrowLeft, BarChart3, CalendarClock, ChevronRight, ClipboardCheck, Pencil, Repeat, Search, Target, TrendingUp, Users,
} from "lucide-react";
import { CabecalhoPagina } from "../componentes/Painel";
import { Aviso, Etiqueta, EstadoVazio, TextoCarregando } from "../componentes/ui";
import { Anel, BarrasHorizontais, CartaoGrafico, Colunas, Indicador, Linha, MedidorBarra, type Tom } from "../componentes/Graficos";
import { IDIOMAS, nomeNivel, useConsulta, type Idioma } from "../lib/dados";
import { CEFR, ORDEM_IDIOMAS } from "../lib/idiomas";
import { HABILIDADES, type Habilidade } from "../lib/exercicios";
import {
  DIAS_INATIVO, MEDIA_ATENCAO, PERIODOS, acertoPorHabilidade, atividade, buscarResultados, buscarResultadosDaLista, diasDesde,
  distribuicao, formatarNota, media, melhoresNotas, primeirasNotas, quandoFoi, textoDaResposta, textoDoGabarito, tomDaNota,
  type DadosResultados, type ListaResumo, type Periodo, type Tentativa,
} from "../lib/resultados";

const TONS_FAIXAS: Tom[] = ["coral", "coral", "azul", "verde", "verde"];

// ---------------------------------------------------------------------------
// Peças comuns
// ---------------------------------------------------------------------------

function Pilula({ ativa, onClick, children }: { ativa: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
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

function IncluirEquipe({ valor, mudar }: { valor: boolean; mudar: (v: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-suave">
      <input type="checkbox" checked={valor} onChange={(e) => mudar(e.target.checked)} className="size-4 accent-[var(--c-marca)]" />
      Incluir testes da equipe
    </label>
  );
}

function Iniciais({ nome }: { nome: string }) {
  const partes = nome.trim().split(/\s+/);
  const letras = ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase() || "?";
  return <span className="grid size-9 shrink-0 place-items-center rounded-full bg-destaque-suave text-xs font-bold text-marca">{letras}</span>;
}

function NotaComBarra({ nota }: { nota: number | null }) {
  return (
    <div className="flex min-w-28 items-center gap-2">
      <div className="flex-1"><MedidorBarra valor={nota} tom={tomDaNota(nota) === "neutro" ? "neutro" : tomDaNota(nota)} fina /></div>
      <span className="w-10 text-right text-sm font-semibold">{formatarNota(nota)}</span>
    </div>
  );
}

const nomeDaLista = (l: ListaResumo) => `${IDIOMAS[l.idioma]} · ${nomeNivel(l.idioma, l.nivel)}`;

function Voltar({ para, children }: { para: string; children: ReactNode }) {
  return (
    <Link to={para} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-suave hover:text-texto">
      <ArrowLeft className="size-4" /> {children}
    </Link>
  );
}

/** Resumo por aluno a partir das tentativas já filtradas. */
function resumoDosAlunos(tentativas: Tentativa[]) {
  const porAluno = new Map<string, { tentativas: number; ultima: string; notas: number[]; listas: Set<string> }>();
  for (const t of tentativas) {
    const r = porAluno.get(t.aluno) ?? { tentativas: 0, ultima: t.em, notas: [], listas: new Set<string>() };
    r.tentativas += 1;
    if (t.em > r.ultima) r.ultima = t.em;
    r.listas.add(t.lista);
    porAluno.set(t.aluno, r);
  }
  for (const m of melhoresNotas(tentativas)) porAluno.get(m.aluno)?.notas.push(m.nota);
  return porAluno;
}

// ---------------------------------------------------------------------------
// Visão geral
// ---------------------------------------------------------------------------

type Aba = "listas" | "alunos";
type OrdemAlunos = "nome" | "menor" | "ativos";

export default function Resultados() {
  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [incluirEquipe, setIncluirEquipe] = useState(false);
  const [idioma, setIdioma] = useState<Idioma | "todos">("todos");
  const [nivel, setNivel] = useState(0);
  const { dados, erro, carregando } = useConsulta<DadosResultados>(() => buscarResultados(periodo, incluirEquipe), [periodo, incluirEquipe]);

  return (
    <>
      <CabecalhoPagina
        etiqueta="Ensino"
        titulo="Resultados"
        descricao="Quem está praticando, as notas e onde os alunos mais erram. Em cada lista vale a melhor nota do aluno, como ele vê."
      />

      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-20 text-[11px] font-bold tracking-[0.12em] text-suave uppercase">Período</span>
          {(Object.keys(PERIODOS) as Periodo[]).map((p) => (
            <Pilula key={p} ativa={periodo === p} onClick={() => setPeriodo(p)}>{PERIODOS[p]}</Pilula>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-20 text-[11px] font-bold tracking-[0.12em] text-suave uppercase">Idioma</span>
          <Pilula ativa={idioma === "todos"} onClick={() => setIdioma("todos")}>Todos</Pilula>
          {ORDEM_IDIOMAS.map((i) => <Pilula key={i} ativa={idioma === i} onClick={() => setIdioma(i)}>{IDIOMAS[i]}</Pilula>)}
          <label className="ml-auto">
            <span className="sr-only">Nível</span>
            <select value={nivel} onChange={(e) => setNivel(Number(e.target.value))} className="h-10 rounded-xl border border-borda bg-superficie px-3 text-sm">
              <option value={0}>Todos os níveis</option>
              {CEFR.map((c, i) => <option key={c} value={i + 1}>{c}{idioma !== "todos" ? ` · ${nomeNivel(idioma, i + 1)}` : ""}</option>)}
            </select>
          </label>
        </div>
        <IncluirEquipe valor={incluirEquipe} mudar={setIncluirEquipe} />
      </div>

      {erro && <Aviso>{erro}</Aviso>}
      {carregando && !dados && <TextoCarregando />}
      {dados && <Painel dados={dados} periodo={periodo} idioma={idioma} nivel={nivel} />}
    </>
  );
}

function Painel({ dados, periodo, idioma, nivel }: { dados: DadosResultados; periodo: Periodo; idioma: Idioma | "todos"; nivel: number }) {
  const [aba, setAba] = useState<Aba>("listas");
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<OrdemAlunos>("menor");

  const listaPorId = useMemo(() => new Map(dados.listas.map((l) => [l.id, l])), [dados.listas]);
  const alunoPorId = useMemo(() => new Map(dados.alunos.map((a) => [a.id, a])), [dados.alunos]);
  const passa = (idLista: string) => {
    const l = listaPorId.get(idLista);
    return !!l && (idioma === "todos" || l.idioma === idioma) && (nivel === 0 || l.nivel === nivel);
  };
  const tentativas = dados.tentativas.filter((t) => passa(t.lista));
  const habilidades = dados.habilidades.filter((h) => passa(h.lista));

  const melhores = melhoresNotas(tentativas);
  const notas = melhores.map((m) => m.nota);
  const porAluno = resumoDosAlunos(tentativas);
  const alunos = [...porAluno.entries()].map(([id, r]) => ({ id, ...r, media: media(r.notas), pessoa: alunoPorId.get(id) }));
  const precisamAtencao = alunos.filter((a) => (a.media ?? 100) < MEDIA_ATENCAO);
  const listasFeitas = new Set(tentativas.map((t) => t.lista));

  if (dados.tentativas.length === 0) {
    return (
      <EstadoVazio
        icone={BarChart3}
        titulo="Ainda não há respostas neste período"
        texto="Assim que os alunos fizerem os exercícios, as notas e os gráficos aparecem aqui. Experimente o período 'Tudo'."
      />
    );
  }

  // Por lista
  const porLista = [...listasFeitas].map((id) => {
    const daLista = tentativas.filter((t) => t.lista === id);
    const notasLista = melhores.filter((m) => m.lista === id).map((m) => m.nota);
    return {
      lista: listaPorId.get(id)!,
      alunos: new Set(daLista.map((t) => t.aluno)).size,
      tentativas: daLista.length,
      media: media(notasLista),
      ultima: daLista.reduce((u, t) => (t.em > u ? t.em : u), daLista[0].em),
    };
  }).sort((a, b) => b.alunos - a.alunos || b.tentativas - a.tentativas);
  const semRespostas = dados.listas.filter((l) => l.status === "publicada" && passa(l.id) && !listasFeitas.has(l.id)).length;

  // Por nível e por habilidade
  const porNivel = CEFR.map((c, i) => {
    const doNivel = melhores.filter((m) => listaPorId.get(m.lista)?.nivel === i + 1).map((m) => m.nota);
    const valor = media(doNivel);
    return { rotulo: c, valor: valor === null ? 0 : Math.round(valor), dica: valor === null ? `${c}: sem respostas` : `${c}: média ${Math.round(valor)}% (${doNivel.length} notas)`, tom: tomDaNota(valor) as Tom };
  });
  const somaHabilidades = acertoPorHabilidade(habilidades);
  const barrasHabilidades = (Object.keys(HABILIDADES) as Habilidade[])
    .filter((h) => somaHabilidades.has(h))
    .map((h) => {
      const { acertos, total } = somaHabilidades.get(h)!;
      const valor = (acertos / total) * 100;
      return { rotulo: HABILIDADES[h], valor, detalhe: `${total} respostas`, tom: tomDaNota(valor) as Tom };
    });

  const grafAtividade = atividade(tentativas, periodo);
  const termo = busca.trim().toLowerCase();
  const alunosVisiveis = alunos
    .filter((a) => !termo || `${a.pessoa?.nome ?? ""} ${a.pessoa?.email ?? ""}`.toLowerCase().includes(termo))
    .sort((a, b) =>
      ordem === "nome" ? (a.pessoa?.nome ?? "").localeCompare(b.pessoa?.nome ?? "")
      : ordem === "ativos" ? b.tentativas - a.tentativas
      : (a.media ?? 101) - (b.media ?? 101));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Indicador icone={Users} rotulo="Alunos praticando" valor={porAluno.size} detalhe={`${PERIODOS[periodo] === "Tudo" ? "desde o início" : `nos últimos ${PERIODOS[periodo]}`}`} />
        <Indicador icone={ClipboardCheck} rotulo="Exercícios feitos" valor={tentativas.length} detalhe={`em ${listasFeitas.size} ${listasFeitas.size === 1 ? "lista" : "listas"} diferentes`} />
        <Indicador icone={Target} rotulo="Nota média" valor={formatarNota(media(notas))} detalhe="melhor nota de cada aluno em cada lista" tom={tomDaNota(media(notas)) === "neutro" ? "marca" : tomDaNota(media(notas))} />
        <Indicador
          icone={AlertTriangle}
          rotulo="Precisam de atenção"
          valor={precisamAtencao.length}
          detalhe={`média abaixo de ${MEDIA_ATENCAO}%`}
          tom={precisamAtencao.length ? "coral" : "verde"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <CartaoGrafico titulo="Atividade" descricao={grafAtividade.porSemana ? "Exercícios enviados por semana" : "Exercícios enviados por dia"} className="xl:col-span-2">
          <Colunas dados={grafAtividade.barras} resumo={`Atividade: ${tentativas.length} exercícios no período.`} />
        </CartaoGrafico>
        <CartaoGrafico titulo="Distribuição das notas" descricao="Quantas notas caem em cada faixa">
          <Colunas
            dados={distribuicao(notas).map((f, i) => ({ rotulo: f.rotulo, valor: f.quantidade, tom: TONS_FAIXAS[i], dica: `${f.rotulo}%: ${f.quantidade} notas` }))}
            resumo={distribuicao(notas).map((f) => `${f.rotulo}%: ${f.quantidade}`).join("; ")}
          />
        </CartaoGrafico>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <CartaoGrafico titulo="Acerto por habilidade" descricao="Porcentagem de respostas certas em cada tipo de questão">
          <BarrasHorizontais dados={barrasHabilidades} resumo={barrasHabilidades.map((b) => `${b.rotulo}: ${Math.round(b.valor)}%`).join("; ")} />
        </CartaoGrafico>
        <CartaoGrafico titulo="Média por nível" descricao="Melhor nota média em cada nível (referência CEFR)">
          <Colunas dados={porNivel} sufixo="%" maximo={100} resumo={porNivel.map((n) => `${n.rotulo}: ${n.valor}%`).join("; ")} />
        </CartaoGrafico>
      </div>

      <CartaoGrafico
        titulo={aba === "listas" ? "Por lista" : "Por aluno"}
        descricao={aba === "listas" ? "Clique numa lista para ver cada questão e os erros mais comuns." : "Clique num aluno para ver a evolução e os pontos fracos."}
        acoes={
          <div className="flex gap-2" role="tablist">
            <Pilula ativa={aba === "listas"} onClick={() => setAba("listas")}>Listas ({porLista.length})</Pilula>
            <Pilula ativa={aba === "alunos"} onClick={() => setAba("alunos")}>Alunos ({alunos.length})</Pilula>
          </div>
        }
      >
        {aba === "listas" ? (
          <>
            {porLista.length === 0 ? (
              <p className="text-sm text-suave">Nenhuma lista com respostas para esses filtros.</p>
            ) : (
              <div className="-mx-5 overflow-x-auto sm:-mx-6">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-borda text-left text-xs text-suave uppercase">
                      <th className="px-5 py-2 font-semibold sm:px-6">Lista</th>
                      <th className="px-3 py-2 text-right font-semibold">Alunos</th>
                      <th className="px-3 py-2 text-right font-semibold">Tentativas</th>
                      <th className="px-3 py-2 font-semibold">Média</th>
                      <th className="px-3 py-2 font-semibold">Última</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {porLista.map((l) => (
                      <tr key={l.lista.id} className="group border-b border-borda last:border-0 hover:bg-fundo">
                        <td className="px-5 py-3 sm:px-6">
                          <Link to={`/resultados/listas/${l.lista.id}`} className="font-serif font-bold text-marca group-hover:underline">
                            {l.lista.titulo}
                          </Link>
                          <span className="block text-xs text-suave">{nomeDaLista(l.lista)}</span>
                        </td>
                        <td className="px-3 py-3 text-right">{l.alunos}</td>
                        <td className="px-3 py-3 text-right">{l.tentativas}</td>
                        <td className="px-3 py-3"><NotaComBarra nota={l.media} /></td>
                        <td className="px-3 py-3 whitespace-nowrap text-suave">{quandoFoi(l.ultima)}</td>
                        <td className="pr-4"><Link to={`/resultados/listas/${l.lista.id}`} aria-hidden="true" tabIndex={-1}><ChevronRight className="size-4 text-suave" /></Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {semRespostas > 0 && (
              <p className="mt-4 text-sm text-suave">{semRespostas} {semRespostas === 1 ? "lista publicada ainda não tem" : "listas publicadas ainda não têm"} respostas nesse período.</p>
            )}
          </>
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-2 sm:flex-row">
              <label className="relative flex-1">
                <span className="sr-only">Buscar aluno</span>
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-suave" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por nome ou e-mail"
                  className="h-10 w-full rounded-xl border border-borda bg-superficie pr-3 pl-9 text-sm focus:border-destaque focus:outline-none"
                />
              </label>
              <label>
                <span className="sr-only">Ordenar</span>
                <select value={ordem} onChange={(e) => setOrdem(e.target.value as OrdemAlunos)} className="h-10 w-full rounded-xl border border-borda bg-superficie px-3 text-sm">
                  <option value="menor">Menor média primeiro</option>
                  <option value="ativos">Mais ativos primeiro</option>
                  <option value="nome">Nome (A–Z)</option>
                </select>
              </label>
            </div>
            <ul className="divide-y divide-borda">
              {alunosVisiveis.map((a) => {
                const atencao = (a.media ?? 100) < MEDIA_ATENCAO;
                const parado = diasDesde(a.ultima) > DIAS_INATIVO;
                return (
                  <li key={a.id}>
                    <Link to={`/resultados/alunos/${a.id}`} className="-mx-2 flex flex-wrap items-center gap-3 rounded-xl px-2 py-3 hover:bg-fundo sm:flex-nowrap">
                      <Iniciais nome={a.pessoa?.nome || a.pessoa?.email || "?"} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-texto">{a.pessoa?.nome || "Sem nome"}</span>
                          {atencao && <Etiqueta tom="coral">Atenção</Etiqueta>}
                          {parado && <Etiqueta tom="creme">Parado há {diasDesde(a.ultima)} dias</Etiqueta>}
                          {a.pessoa && a.pessoa.papel !== "aluno" && <Etiqueta>Equipe</Etiqueta>}
                        </span>
                        <span className="block truncate text-xs text-suave">{a.pessoa?.email}</span>
                      </span>
                      <span className="w-24 text-sm text-suave">{a.listas.size} {a.listas.size === 1 ? "lista" : "listas"}</span>
                      <span className="w-40"><NotaComBarra nota={a.media} /></span>
                      <span className="w-20 text-right text-xs text-suave">{quandoFoi(a.ultima)}</span>
                      <ChevronRight className="hidden size-4 text-suave sm:block" />
                    </Link>
                  </li>
                );
              })}
              {alunosVisiveis.length === 0 && <li className="py-4 text-sm text-suave">Nenhum aluno encontrado.</li>}
            </ul>
          </>
        )}
      </CartaoGrafico>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Uma lista
// ---------------------------------------------------------------------------

type DadosLista = NonNullable<Awaited<ReturnType<typeof buscarResultadosDaLista>>["data"]>;

export function ResultadoLista() {
  const { id = "" } = useParams();
  const [incluirEquipe, setIncluirEquipe] = useState(false);
  const [maisErradas, setMaisErradas] = useState(false);
  const { dados, erro, carregando } = useConsulta<DadosLista>(() => buscarResultadosDaLista(id, incluirEquipe), [id, incluirEquipe]);

  if (carregando && !dados) return <TextoCarregando />;
  if (erro || !dados) return <Aviso>{erro || "Lista não encontrada."}</Aviso>;
  const { lista, questoes, alunos } = dados;
  const tentativas = dados.tentativas.map((t) => ({ ...t, lista: lista.id }));
  const melhores = melhoresNotas(tentativas).map((m) => m.nota);
  const primeiras = primeirasNotas(tentativas);
  const mediaMelhor = media(melhores);
  const faixas = distribuicao(melhores);
  const dificeis = questoes.filter((q) => q.acerto !== null && q.acerto < 0.6).length;
  const ordenadas = questoes.map((q, i) => ({ ...q, numero: i + 1 }));
  if (maisErradas) ordenadas.sort((a, b) => (a.acerto ?? 2) - (b.acerto ?? 2));
  const porAluno = resumoDosAlunos(tentativas);

  return (
    <>
      <Voltar para="/resultados">Resultados</Voltar>
      <CabecalhoPagina
        etiqueta={nomeDaLista(lista)}
        titulo={lista.titulo}
        acoes={
          <Link to={`/exercicios/${lista.id}`} className="inline-flex h-11 items-center gap-2 rounded-xl border border-borda bg-superficie px-4 text-sm font-semibold hover:bg-fundo">
            <Pencil className="size-4" /> Abrir no editor
          </Link>
        }
      />
      <div className="mb-6"><IncluirEquipe valor={incluirEquipe} mudar={setIncluirEquipe} /></div>

      {tentativas.length === 0 ? (
        <EstadoVazio icone={BarChart3} titulo="Ninguém fez esta lista ainda" texto="Compartilhe o link da lista com os alunos. As respostas aparecem aqui assim que eles enviarem." />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <Indicador icone={Users} rotulo="Alunos" valor={porAluno.size} detalhe="fizeram esta lista" />
            <Indicador icone={Repeat} rotulo="Tentativas" valor={tentativas.length} detalhe={`${(tentativas.length / porAluno.size).toFixed(1).replace(".", ",")} por aluno`} />
            <Indicador icone={TrendingUp} rotulo="1ª tentativa" valor={formatarNota(media(primeiras.map((p) => p.nota)))} detalhe="média antes de ver a correção" tom={tomDaNota(media(primeiras.map((p) => p.nota))) === "neutro" ? "marca" : tomDaNota(media(primeiras.map((p) => p.nota)))} />
            <Indicador icone={AlertTriangle} rotulo="Questões difíceis" valor={dificeis} detalhe="com menos de 60% de acerto" tom={dificeis ? "coral" : "verde"} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <CartaoGrafico titulo="Média da lista" descricao="Melhor nota de cada aluno">
              <div className="flex items-center gap-5">
                <Anel valor={mediaMelhor} tom={tomDaNota(mediaMelhor) === "neutro" ? "neutro" : tomDaNota(mediaMelhor)} rotulo="Média da lista" />
                <ul className="space-y-1 text-sm text-suave">
                  <li><strong className="text-sucesso">{melhores.filter((n) => n >= 80).length}</strong> com 80% ou mais</li>
                  <li><strong className="text-destaque">{melhores.filter((n) => n >= 60 && n < 80).length}</strong> entre 60% e 79%</li>
                  <li><strong className="text-coral">{melhores.filter((n) => n < 60).length}</strong> abaixo de 60%</li>
                </ul>
              </div>
            </CartaoGrafico>
            <CartaoGrafico titulo="Distribuição das notas" className="lg:col-span-2">
              <Colunas
                altura={140}
                dados={faixas.map((f, i) => ({ rotulo: f.rotulo, valor: f.quantidade, tom: TONS_FAIXAS[i], dica: `${f.rotulo}%: ${f.quantidade} alunos` }))}
                resumo={faixas.map((f) => `${f.rotulo}%: ${f.quantidade}`).join("; ")}
              />
            </CartaoGrafico>
          </div>

          <CartaoGrafico
            titulo="Questão por questão"
            descricao="Acerto de todas as respostas enviadas. Abra uma questão para ver a resposta certa e os erros mais comuns."
            acoes={
              <div className="flex gap-2">
                <Pilula ativa={!maisErradas} onClick={() => setMaisErradas(false)}>Ordem da lista</Pilula>
                <Pilula ativa={maisErradas} onClick={() => setMaisErradas(true)}>Mais erradas primeiro</Pilula>
              </div>
            }
          >
            <ol className="space-y-2">
              {ordenadas.map((q) => {
                const acerto = q.acerto === null ? null : q.acerto * 100;
                const tom = tomDaNota(acerto);
                return (
                  <li key={q.id}>
                    <details className="group rounded-xl border border-borda open:bg-fundo">
                      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-3 sm:flex-nowrap">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-creme text-xs font-bold text-suave">{q.numero}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-texto">{q.enunciado}</span>
                          <span className="text-xs text-suave">{q.secao ? `${q.secao} · ` : ""}{HABILIDADES[q.habilidade]} · {q.respostas} respostas</span>
                        </span>
                        <span className="w-full sm:w-44"><NotaComBarra nota={acerto} /></span>
                        <ChevronRight className="hidden size-4 shrink-0 text-suave transition group-open:rotate-90 sm:block" />
                      </summary>
                      <div className="space-y-2 border-t border-borda px-4 py-3 text-sm">
                        <p><span className="text-suave">Resposta certa:</span> <strong className="text-sucesso">{textoDoGabarito(q)}</strong></p>
                        {q.erradas.length > 0 ? (
                          <div>
                            <p className="mb-1 text-suave">Erros mais comuns:</p>
                            <ul className="space-y-1">
                              {q.erradas.map((e, i) => (
                                <li key={i} className="flex items-center justify-between gap-3 rounded-lg bg-superficie px-3 py-1.5">
                                  <span className="text-coral">{textoDaResposta(q, e.resposta)}</span>
                                  <span className="shrink-0 text-xs text-suave">{e.vezes}×</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <p className="text-suave">{tom === "verde" || acerto === 100 ? "Ninguém errou esta questão." : "Sem respostas erradas registradas."}</p>
                        )}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ol>
          </CartaoGrafico>

          <CartaoGrafico titulo="Alunos" descricao="Primeira e melhor nota de cada aluno nesta lista">
            <div className="-mx-5 overflow-x-auto sm:-mx-6">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-borda text-left text-xs text-suave uppercase">
                    <th className="px-5 py-2 font-semibold sm:px-6">Aluno</th>
                    <th className="px-3 py-2 text-right font-semibold">Tentativas</th>
                    <th className="px-3 py-2 font-semibold">1ª nota</th>
                    <th className="px-3 py-2 font-semibold">Melhor</th>
                    <th className="px-3 py-2 font-semibold">Última</th>
                  </tr>
                </thead>
                <tbody>
                  {alunos.map((p) => {
                    const r = porAluno.get(p.id);
                    if (!r) return null;
                    const primeira = primeiras.find((t) => t.aluno === p.id)?.nota ?? null;
                    return (
                      <tr key={p.id} className="border-b border-borda last:border-0">
                        <td className="px-5 py-3 sm:px-6">
                          <Link to={`/resultados/alunos/${p.id}`} className="font-semibold text-marca hover:underline">{p.nome || p.email}</Link>
                        </td>
                        <td className="px-3 py-3 text-right">{r.tentativas}</td>
                        <td className="px-3 py-3 text-suave">{formatarNota(primeira)}</td>
                        <td className="px-3 py-3"><NotaComBarra nota={r.notas[0] ?? null} /></td>
                        <td className="px-3 py-3 whitespace-nowrap text-suave">{quandoFoi(r.ultima)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CartaoGrafico>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Um aluno
// ---------------------------------------------------------------------------

export function ResultadoAluno() {
  const { id = "" } = useParams();
  // Tudo, inclusive a equipe: quem chega aqui já escolheu esta pessoa.
  const { dados, erro, carregando } = useConsulta<DadosResultados>(() => buscarResultados("tudo", true), []);

  if (carregando && !dados) return <TextoCarregando />;
  if (erro || !dados) return <Aviso>{erro || "Não foi possível carregar."}</Aviso>;
  const pessoa = dados.alunos.find((a) => a.id === id);
  const tentativas = dados.tentativas.filter((t) => t.aluno === id);
  if (!pessoa || tentativas.length === 0) {
    return (
      <>
        <Voltar para="/resultados">Resultados</Voltar>
        <EstadoVazio icone={Users} titulo="Sem respostas deste aluno" texto="Quando ele enviar algum exercício, o histórico aparece aqui." />
      </>
    );
  }

  const listaPorId = new Map(dados.listas.map((l) => [l.id, l]));
  const melhores = melhoresNotas(tentativas);
  const primeiras = primeirasNotas(tentativas);
  const mediaAluno = media(melhores.map((m) => m.nota));
  const ultima = tentativas[tentativas.length - 1].em;
  const formatoData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
  const pontos = tentativas.map((t) => ({
    rotulo: formatoData.format(new Date(t.em)),
    valor: t.nota,
    dica: `${listaPorId.get(t.lista)?.titulo ?? "Lista"} · ${formatoData.format(new Date(t.em))}: ${t.nota}%`,
  }));
  const soma = acertoPorHabilidade(dados.habilidades.filter((h) => h.aluno === id));
  const barras = (Object.keys(HABILIDADES) as Habilidade[])
    .filter((h) => soma.has(h))
    .map((h) => {
      const { acertos, total } = soma.get(h)!;
      const valor = (acertos / total) * 100;
      return { habilidade: h, rotulo: HABILIDADES[h], valor, detalhe: `${total} respostas`, tom: tomDaNota(valor) as Tom };
    });
  const maisFraca = barras.length > 1 ? [...barras].sort((a, b) => a.valor - b.valor)[0] : null;
  const listas = melhores
    .map((m) => {
      const daLista = tentativas.filter((t) => t.lista === m.lista);
      return {
        lista: listaPorId.get(m.lista),
        id: m.lista,
        melhor: m.nota,
        primeira: primeiras.find((p) => p.lista === m.lista)?.nota ?? null,
        vezes: daLista.length,
        ultima: daLista[daLista.length - 1].em,
      };
    })
    .sort((a, b) => b.ultima.localeCompare(a.ultima));
  const parado = diasDesde(ultima) > DIAS_INATIVO;

  return (
    <>
      <Voltar para="/resultados">Resultados</Voltar>
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <span className="grid size-14 place-items-center rounded-full bg-marinho-800 font-serif text-xl font-bold text-white">
          {(pessoa.nome || pessoa.email).trim()[0]?.toUpperCase()}
        </span>
        <div>
          <p className="text-[11px] font-bold tracking-[0.14em] text-destaque uppercase">{pessoa.papel === "aluno" ? "Aluno" : "Equipe"}</p>
          <h1 className="text-3xl font-bold text-marca">{pessoa.nome || "Sem nome"}</h1>
          <p className="text-sm text-suave">{pessoa.email}</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <Indicador icone={ClipboardCheck} rotulo="Listas feitas" valor={melhores.length} detalhe={`${tentativas.length} tentativas no total`} />
          <Indicador icone={Target} rotulo="Média" valor={formatarNota(mediaAluno)} detalhe="melhor nota em cada lista" tom={tomDaNota(mediaAluno) === "neutro" ? "marca" : tomDaNota(mediaAluno)} />
          <Indicador icone={TrendingUp} rotulo="1ª tentativa" valor={formatarNota(media(primeiras.map((p) => p.nota)))} detalhe="média antes de ver a correção" />
          <Indicador icone={CalendarClock} rotulo="Última atividade" valor={<span className="text-2xl sm:text-3xl">{quandoFoi(ultima)}</span>} detalhe={parado ? `parado há mais de ${DIAS_INATIVO} dias` : "está praticando"} tom={parado ? "coral" : "verde"} />
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <CartaoGrafico titulo="Evolução das notas" descricao="Cada ponto é um exercício enviado, em ordem" className="xl:col-span-2">
            <Linha dados={pontos} resumo={`Notas em ordem: ${pontos.map((p) => `${p.valor}%`).join(", ")}`} />
          </CartaoGrafico>
          <CartaoGrafico titulo="Por habilidade" descricao="Acerto em cada tipo de questão">
            <BarrasHorizontais dados={barras} resumo={barras.map((b) => `${b.rotulo}: ${Math.round(b.valor)}%`).join("; ")} />
            {maisFraca && maisFraca.valor < 80 && (
              <p className="mt-4 rounded-xl bg-coral-suave px-3 py-2 text-sm text-texto">
                Ponto a reforçar: <strong>{maisFraca.rotulo}</strong> ({Math.round(maisFraca.valor)}% de acerto).
              </p>
            )}
          </CartaoGrafico>
        </div>

        <CartaoGrafico titulo="Listas" descricao="Da mais recente para a mais antiga">
          <div className="-mx-5 overflow-x-auto sm:-mx-6">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-borda text-left text-xs text-suave uppercase">
                  <th className="px-5 py-2 font-semibold sm:px-6">Lista</th>
                  <th className="px-3 py-2 text-right font-semibold">Vezes</th>
                  <th className="px-3 py-2 font-semibold">1ª nota</th>
                  <th className="px-3 py-2 font-semibold">Melhor</th>
                  <th className="px-3 py-2 font-semibold">Última</th>
                </tr>
              </thead>
              <tbody>
                {listas.map((l) => (
                  <tr key={l.id} className="border-b border-borda last:border-0">
                    <td className="px-5 py-3 sm:px-6">
                      <Link to={`/resultados/listas/${l.id}`} className="font-serif font-bold text-marca hover:underline">{l.lista?.titulo ?? "Lista apagada"}</Link>
                      {l.lista && <span className="block text-xs text-suave">{nomeDaLista(l.lista)}</span>}
                    </td>
                    <td className="px-3 py-3 text-right">{l.vezes}</td>
                    <td className="px-3 py-3 text-suave">{formatarNota(l.primeira)}</td>
                    <td className="px-3 py-3"><NotaComBarra nota={l.melhor} /></td>
                    <td className="px-3 py-3 whitespace-nowrap text-suave">{quandoFoi(l.ultima)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CartaoGrafico>
      </div>
    </>
  );
}
