import { useState, type ReactNode } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router";
import {
  ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ChevronRight, ClipboardList, FileText, Headphones, Home, Hourglass, Search, Sparkles, Video,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { IDIOMAS, nomeNivel, useConsulta } from "../lib/dados";
import { buscarEncontros, resumoHorarios, type Encontros } from "../lib/aoVivo";
import { buscarConteudoDaTurma, ehNova, type AulaDaTurma, type ConteudoDaTurma, type ListaDaTurma, type TurmaDoAluno } from "../lib/turmas";
import { CabecalhoPagina } from "../componentes/Painel";
import AulaAoVivo, { resumoAoVivo, useRelogio } from "../componentes/AulaAoVivo";
import { BarraProgresso, CartaoLista, EntrarNaTurma, Pilula, useTurmasDoAluno } from "../componentes/TurmaAluno";
import { Aviso, Etiqueta, EstadoVazio, Pontilhado, TextoCarregando } from "../componentes/ui";

function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] || "";
}

const idsDasListas = (c: ConteudoDaTurma) => [...new Set([...c.aulas.flatMap((a) => a.listas.map((l) => l.id)), ...c.extras.map((l) => l.id)])];

/** Conteúdo e link ao vivo de uma turma, carregados juntos. */
function useTurma(idTurma: string) {
  const { perfil } = useAuth();
  return useConsulta<{ conteudo: ConteudoDaTurma; encontros: Encontros | null }>(async () => {
    const [conteudo, encontros] = await Promise.all([buscarConteudoDaTurma(idTurma, perfil?.id ?? ""), buscarEncontros(idTurma)]);
    if (conteudo.error || !conteudo.data) return { data: null, error: conteudo.error };
    return { data: { conteudo: conteudo.data, encontros: encontros.data }, error: null };
  }, [idTurma, perfil?.id]);
}

// =====================================================================================
// Minhas turmas: um bloco por turma
// =====================================================================================

export function MinhasTurmas() {
  const { perfil } = useAuth();
  const [parametros] = useSearchParams();
  const { turmas, erro, carregando, recarregar } = useTurmasDoAluno();
  const equipe = perfil?.papel !== "aluno";

  // Endereço antigo (/aluno?turma=...) usado em notificações: vai direto para a turma.
  const antiga = parametros.get("turma");
  if (antiga) return <Navigate to={`/aluno/turmas/${antiga}`} replace />;

  const aprovadas = turmas.filter((t) => t.situacao === "aprovada");
  const pendentes = turmas.filter((t) => t.situacao === "pendente");

  return (
    <>
      <CabecalhoPagina
        etiqueta={equipe ? "Visão do aluno" : "Meus estudos"}
        titulo={equipe ? "Turmas como o aluno vê" : `Olá, ${primeiroNome(perfil?.nome ?? "") || "aluno"}!`}
        descricao={
          equipe
            ? "Escolha uma turma para ver exatamente o que os alunos dela veem: só as aulas liberadas e os exercícios publicados."
            : "Escolha uma turma para ver as aulas, os exercícios e o link da aula ao vivo."
        }
      />
      {erro && <Aviso>{erro}</Aviso>}
      {carregando && <TextoCarregando />}
      {!carregando && (
        <div className="space-y-10">
          {(aprovadas.length > 0 || pendentes.length > 0) && (
            <section aria-label="Minhas turmas">
              <ul className="grid gap-5 md:grid-cols-2">
                {aprovadas.map((t) => <BlocoTurma key={t.id} turma={t} />)}
                {pendentes.map((t) => (
                  <li key={t.id} className="flex flex-col rounded-3xl border-2 border-dashed border-borda p-6">
                    <span className="flex items-center gap-2 text-sm font-semibold text-destaque"><Hourglass className="size-4" /> Aguardando aprovação</span>
                    <h2 className="mt-3 text-2xl font-bold text-marca">{t.nome}</h2>
                    <p className="mt-2 text-sm text-suave">Seu pedido foi enviado. Assim que a professora aprovar, a turma abre aqui com as aulas e os exercícios.</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {equipe && aprovadas.length === 0 && (
            <EstadoVazio icone={BookOpen} titulo="Nenhuma turma ainda" texto="Crie uma turma em Turmas para ver como os alunos dela enxergam as aulas e os exercícios." />
          )}
          {!equipe && <EntrarNaTurma aoEntrar={recarregar} destaque={turmas.length === 0} />}
        </div>
      )}
    </>
  );
}

function BlocoTurma({ turma }: { turma: TurmaDoAluno }) {
  const { dados } = useTurma(turma.id);
  const agora = useRelogio();
  const ids = dados ? idsDasListas(dados.conteudo) : [];
  const feitas = dados ? ids.filter((id) => dados.conteudo.notas[id] !== undefined).length : 0;
  const aulaNova = dados?.conteudo.aulas.some((a) => ehNova(a.liberadaEm));
  const extrasNovos = dados?.conteudo.extras.filter((l) => ehNova(l.liberadaEm) && dados.conteudo.notas[l.id] === undefined).length ?? 0;
  const aoVivo = dados ? resumoAoVivo(dados.encontros, agora) : null;

  return (
    <li>
      <Link to={`/aluno/turmas/${turma.id}`} className="group flex h-full flex-col overflow-hidden rounded-3xl border border-borda bg-superficie transition hover:border-destaque hover:shadow-md">
        <div className="bg-marinho-800 px-6 pt-6 pb-5 text-white">
          <p className="text-[11px] font-bold tracking-[0.14em] text-azul-300 uppercase">
            {turma.curso ? `${IDIOMAS[turma.curso.idioma]} · ${nomeNivel(turma.curso.idioma, turma.curso.nivel)}` : "Turma"}
          </p>
          <h2 className="mt-1 text-2xl font-bold">{turma.nome}</h2>
          {turma.curso && <p className="font-serif text-azul-300 italic">{turma.curso.titulo}</p>}
          <Pontilhado className="mt-4 text-white/70" />
        </div>
        <div className="flex flex-1 flex-col gap-4 p-6">
          <div className="flex flex-wrap gap-1.5">
            {aoVivo && (
              <Etiqueta tom={aoVivo.destaque ? "verde" : "azul"}><Video className="mr-1 size-3.5" /> {aoVivo.texto}</Etiqueta>
            )}
            {aulaNova && <Etiqueta tom="coral">Aula nova</Etiqueta>}
            {extrasNovos > 0 && <Etiqueta tom="coral">{extrasNovos} {extrasNovos === 1 ? "extra novo" : "extras novos"}</Etiqueta>}
          </div>
          {dados ? (
            <div>
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="text-suave">{dados.conteudo.aulas.length} {dados.conteudo.aulas.length === 1 ? "aula liberada" : "aulas liberadas"}</span>
                <span className="font-semibold">{feitas} de {ids.length} exercícios</span>
              </div>
              <BarraProgresso feitas={feitas} total={ids.length} rotulo={`Progresso em ${turma.nome}`} />
            </div>
          ) : (
            <p className="text-sm text-suave">Carregando…</p>
          )}
          <div className="mt-auto flex items-center justify-between pt-2 text-sm">
            <span className="text-suave">{turma.professor ? `com ${turma.professor}` : ""}</span>
            <span className="inline-flex items-center gap-1 font-semibold text-destaque group-hover:underline">Abrir turma <ArrowRight className="size-4" /></span>
          </div>
        </div>
      </Link>
    </li>
  );
}

// =====================================================================================
// Página da turma (aluno), com abas
// =====================================================================================

type Aba = "inicio" | "aulas" | "exercicios" | "aovivo";

function BotaoAba({ ativa, onClick, icone: Icone, children, contador, ponto }: {
  ativa: boolean; onClick: () => void; icone: typeof Home; children: ReactNode; contador?: number; ponto?: boolean;
}) {
  return (
    <button
      role="tab"
      aria-selected={ativa}
      onClick={onClick}
      className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition ${
        ativa ? "border-marca text-marca" : "border-transparent text-suave hover:text-texto"
      }`}
    >
      <Icone className="size-4" /> {children}
      {contador !== undefined && <span className="rounded-full bg-creme px-2 py-0.5 text-xs text-suave">{contador}</span>}
      {ponto && <span className="size-2 animate-pulse rounded-full bg-sucesso" aria-label="ao vivo" />}
    </button>
  );
}

export function TurmaDoAluno() {
  const { id = "" } = useParams();
  const { perfil } = useAuth();
  const [parametros, setParametros] = useSearchParams();
  const { turmas, carregando: carregandoTurmas } = useTurmasDoAluno();
  const { dados, erro, carregando } = useTurma(id);
  const agora = useRelogio();
  const equipe = perfil?.papel !== "aluno";
  const aba = (parametros.get("aba") as Aba | null) ?? "inicio";
  const mudarAba = (nova: Aba) => setParametros(nova === "inicio" ? {} : { aba: nova }, { replace: true });

  const turma = turmas.find((t) => t.id === id);
  const voltar = (
    <Link to="/aluno" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-suave hover:text-texto">
      <ArrowLeft className="size-4" /> {equipe ? "Visão do aluno" : "Minhas turmas"}
    </Link>
  );

  if (carregandoTurmas || (carregando && !dados)) return <TextoCarregando />;
  if (!turma) return <>{voltar}<Aviso>Turma não encontrada.</Aviso></>;
  if (turma.situacao === "pendente") {
    return (
      <>
        {voltar}
        <EstadoVazio icone={Hourglass} titulo="Aguardando aprovação" texto={`Seu pedido para entrar na turma ${turma.nome} foi enviado. Assim que a professora aprovar, as aulas e os exercícios aparecem aqui.`} />
      </>
    );
  }
  if (erro || !dados) return <>{voltar}<Aviso>{erro || "Não foi possível abrir a turma."}</Aviso></>;

  const { conteudo, encontros } = dados;
  const ids = idsDasListas(conteudo);
  const feitas = ids.filter((x) => conteudo.notas[x] !== undefined).length;
  const aoVivo = resumoAoVivo(encontros, agora);

  return (
    <>
      {voltar}
      {equipe && <div className="mb-4"><Aviso tipo="info">Você está vendo esta turma como os alunos dela veem.</Aviso></div>}

      <section className="mb-6 overflow-hidden rounded-3xl bg-marinho-800 px-6 py-7 text-white sm:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[0.14em] text-azul-300 uppercase">
              {turma.curso ? `${IDIOMAS[turma.curso.idioma]} · ${nomeNivel(turma.curso.idioma, turma.curso.nivel)}` : "Turma"}
              {turma.professor ? ` · com ${turma.professor}` : ""}
            </p>
            <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{turma.nome}</h1>
            {turma.curso && <p className="font-serif text-lg text-azul-300 italic">{turma.curso.titulo}</p>}
          </div>
          <AulaAoVivo encontros={encontros} compacto />
        </div>
        <div className="mt-5 max-w-xl">
          <div className="mb-1.5 flex justify-between text-sm text-white/80">
            <span>Seu progresso</span>
            <span>{feitas} de {ids.length} exercícios</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/20" aria-hidden="true">
            <div className="h-full rounded-full bg-azul-300" style={{ width: `${ids.length ? (feitas / ids.length) * 100 : 0}%` }} />
          </div>
        </div>
      </section>

      <div className="mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-borda [scrollbar-width:none]" role="tablist">
        <BotaoAba ativa={aba === "inicio"} onClick={() => mudarAba("inicio")} icone={Home}>Início</BotaoAba>
        <BotaoAba ativa={aba === "aulas"} onClick={() => mudarAba("aulas")} icone={BookOpen} contador={conteudo.aulas.length}>Aulas</BotaoAba>
        <BotaoAba ativa={aba === "exercicios"} onClick={() => mudarAba("exercicios")} icone={ClipboardList} contador={ids.length}>Exercícios</BotaoAba>
        <BotaoAba ativa={aba === "aovivo"} onClick={() => mudarAba("aovivo")} icone={Video} ponto={!!aoVivo?.destaque}>Ao vivo</BotaoAba>
      </div>

      {aba === "inicio" && <AbaInicio idTurma={turma.id} conteudo={conteudo} encontros={encontros} irPara={mudarAba} />}
      {aba === "aulas" && <ListaDeAulas idTurma={turma.id} conteudo={conteudo} />}
      {aba === "exercicios" && <ExerciciosDaTurma idTurma={turma.id} conteudo={conteudo} />}
      {aba === "aovivo" && <AbaAoVivo encontros={encontros} />}
    </>
  );
}

// ---------------------------------------------------------------- Início

/** Primeira lista ainda não feita: começa pela aula mais recente (é o assunto da semana), depois as anteriores, depois os extras. */
function proximoExercicio(conteudo: ConteudoDaTurma): { lista: ListaDaTurma; aula: AulaDaTurma | null } | null {
  for (const aula of [...conteudo.aulas].reverse()) {
    const lista = aula.listas.find((l) => conteudo.notas[l.id] === undefined);
    if (lista) return { lista, aula };
  }
  const extra = conteudo.extras.find((l) => conteudo.notas[l.id] === undefined);
  return extra ? { lista: extra, aula: null } : null;
}

function AbaInicio({ idTurma, conteudo, encontros, irPara }: { idTurma: string; conteudo: ConteudoDaTurma; encontros: Encontros | null; irPara: (aba: Aba) => void }) {
  const proximo = proximoExercicio(conteudo);
  const ultimaAula = conteudo.aulas[conteudo.aulas.length - 1];
  const extrasNovos = conteudo.extras.filter((l) => ehNova(l.liberadaEm));
  const listasAulas = conteudo.aulas.flatMap((a) => a.listas);
  const feitasAulas = listasAulas.filter((l) => conteudo.notas[l.id] !== undefined).length;
  const feitasExtras = conteudo.extras.filter((l) => conteudo.notas[l.id] !== undefined).length;

  return (
    <div className="space-y-6">
      <AulaAoVivo encontros={encontros} />

      {proximo ? (
        <Link
          to={`/praticar/${proximo.lista.id}?turma=${idTurma}`}
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
      ) : (
        quantasListas(conteudo) > 0 && (
          <div className="flex items-center gap-3 rounded-2xl border border-sucesso/40 bg-sucesso-suave p-5 text-sm">
            <CheckCircle2 className="size-6 shrink-0 text-sucesso" />
            <p><strong>Tudo feito!</strong> Você fez todos os exercícios liberados. Pode refazer para melhorar a nota quando quiser.</p>
          </div>
        )
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Atalho
          icone={BookOpen}
          titulo="Aulas"
          numero={conteudo.aulas.length}
          texto={ultimaAula ? `Última: Aula ${ultimaAula.numero} · ${ultimaAula.titulo}` : "Nenhuma aula liberada ainda."}
          selo={ultimaAula && ehNova(ultimaAula.liberadaEm) ? "Nova" : undefined}
          onClick={() => irPara("aulas")}
        />
        <Atalho
          icone={ClipboardList}
          titulo="Exercícios das aulas"
          numero={listasAulas.length}
          texto={`${feitasAulas} de ${listasAulas.length} feitos`}
          onClick={() => irPara("exercicios")}
        />
        <Atalho
          icone={Sparkles}
          titulo="Extras"
          numero={conteudo.extras.length}
          texto={conteudo.extras.length ? `${feitasExtras} de ${conteudo.extras.length} feitos` : "Nenhum extra ainda."}
          selo={extrasNovos.length ? `${extrasNovos.length} ${extrasNovos.length === 1 ? "novo" : "novos"}` : undefined}
          onClick={() => irPara("exercicios")}
        />
      </div>

      {ultimaAula && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-marca">Aula mais recente</h2>
          <CartaoAula idTurma={idTurma} aula={ultimaAula} notas={conteudo.notas} />
        </section>
      )}
    </div>
  );
}
const quantasListas = (c: ConteudoDaTurma) => idsDasListas(c).length;

function Atalho({ icone: Icone, titulo, numero, texto, selo, onClick }: { icone: typeof Home; titulo: string; numero: number; texto: string; selo?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col rounded-2xl border border-borda bg-superficie p-5 text-left transition hover:border-destaque hover:shadow-sm">
      <span className="flex items-center justify-between">
        <span className="grid size-10 place-items-center rounded-xl bg-destaque-suave text-marca"><Icone className="size-5" /></span>
        <span className="flex items-center gap-2">
          {selo && <Etiqueta tom="coral">{selo}</Etiqueta>}
          <span className="font-serif text-3xl font-bold text-marca">{numero}</span>
        </span>
      </span>
      <span className="mt-3 font-bold text-marca">{titulo}</span>
      <span className="mt-0.5 text-sm text-suave">{texto}</span>
    </button>
  );
}

// ---------------------------------------------------------------- Aulas

function CartaoAula({ idTurma, aula, notas }: { idTurma: string; aula: AulaDaTurma; notas: Record<string, number> }) {
  const feitas = aula.listas.filter((l) => notas[l.id] !== undefined).length;
  const completa = aula.listas.length > 0 && feitas === aula.listas.length;
  return (
    <Link to={`/aulas/${aula.id}?turma=${idTurma}`} className="flex flex-wrap items-center gap-4 rounded-2xl border border-borda bg-superficie p-4 transition hover:border-destaque hover:shadow-sm sm:flex-nowrap sm:p-5">
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
              {feitas} de {aula.listas.length} {aula.listas.length === 1 ? "exercício" : "exercícios"}
            </Etiqueta>
          )}
          {aula.listas.some((l) => l.secoes.some((s) => s.tipo_estimulo === "audio")) && <Etiqueta><Headphones className="mr-1 size-3.5" /> Listening</Etiqueta>}
        </span>
      </span>
      <span className="hidden items-center gap-1 text-sm font-semibold text-destaque sm:inline-flex">Abrir aula <ChevronRight className="size-4" /></span>
    </Link>
  );
}

function ListaDeAulas({ idTurma, conteudo }: { idTurma: string; conteudo: ConteudoDaTurma }) {
  if (conteudo.aulas.length === 0) {
    return <EstadoVazio icone={BookOpen} titulo="Nenhuma aula liberada ainda" texto="Assim que a professora liberar a primeira aula, ela aparece aqui com o material e os exercícios." />;
  }
  return (
    <>
      <p className="mb-4 text-sm text-suave">Da mais recente para a primeira. Cada aula tem o material e os exercícios dela.</p>
      <ul className="space-y-3">
        {[...conteudo.aulas].reverse().map((aula) => (
          <li key={aula.id}><CartaoAula idTurma={idTurma} aula={aula} notas={conteudo.notas} /></li>
        ))}
      </ul>
    </>
  );
}

// ---------------------------------------------------------------- Exercícios

type Situacao = "todas" | "pendentes" | "feitas";
type Tipo = "aulas" | "extras";

function ExerciciosDaTurma({ idTurma, conteudo }: { idTurma: string; conteudo: ConteudoDaTurma }) {
  const [tipo, setTipo] = useState<Tipo>("aulas");
  const [situacao, setSituacao] = useState<Situacao>("todas");
  const [busca, setBusca] = useState("");
  const { notas } = conteudo;

  const termo = busca.trim().toLowerCase();
  const passa = (l: ListaDaTurma) =>
    (situacao === "todas" || (situacao === "feitas" ? notas[l.id] !== undefined : notas[l.id] === undefined)) &&
    (!termo || `${l.titulo} ${l.descricao}`.toLowerCase().includes(termo));
  const listasDasAulas = conteudo.aulas.flatMap((a) => a.listas);
  const doTipo = tipo === "aulas" ? listasDasAulas : conteudo.extras;
  const feitas = doTipo.filter((l) => notas[l.id] !== undefined).length;
  const aulas = [...conteudo.aulas].reverse().map((a) => ({ ...a, visiveis: a.listas.filter(passa) })).filter((a) => a.visiveis.length > 0);
  const extras = conteudo.extras.filter(passa);
  const nadaComFiltro = tipo === "aulas" ? aulas.length === 0 : extras.length === 0;

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Tipo de exercício">
        {([
          ["aulas", "Das aulas", BookOpen, listasDasAulas.length],
          ["extras", "Extras", Sparkles, conteudo.extras.length],
        ] as const).map(([valor, rotulo, Icone, quantidade]) => (
          <button
            key={valor}
            onClick={() => setTipo(valor)}
            aria-pressed={tipo === valor}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
              tipo === valor ? "border-marca bg-marca text-sobre-marca" : "border-borda bg-superficie text-suave hover:text-texto"
            }`}
          >
            <Icone className="size-4" /> {rotulo} <span className="opacity-70">({quantidade})</span>
          </button>
        ))}
      </div>

      {doTipo.length > 0 && (
        <>
          <div className="mb-5 rounded-2xl border border-borda bg-superficie p-5">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold">{tipo === "aulas" ? "Exercícios das aulas" : "Exercícios extras"}</span>
              <span className="text-suave">{feitas} de {doTipo.length} feitos</span>
            </div>
            <BarraProgresso feitas={feitas} total={doTipo.length} rotulo="Progresso" />
          </div>
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
        </>
      )}

      {doTipo.length === 0 ? (
        <EstadoVazio
          icone={tipo === "aulas" ? BookOpen : Sparkles}
          titulo={tipo === "aulas" ? "Nenhum exercício de aula ainda" : "Nenhum exercício extra ainda"}
          texto={tipo === "aulas" ? "Os exercícios aparecem aqui quando a professora libera as aulas." : "Quando a professora liberar exercícios extras para a turma, eles aparecem aqui."}
        />
      ) : nadaComFiltro ? (
        <p className="text-sm text-suave">Nenhum exercício com esses filtros.</p>
      ) : tipo === "aulas" ? (
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
                  <span className="text-suave">{aula.listas.filter((l) => notas[l.id] !== undefined).length} de {aula.listas.length} feitos</span>
                  <Link to={`/aulas/${aula.id}?turma=${idTurma}`} className="font-semibold text-destaque hover:underline">Abrir aula →</Link>
                </span>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {aula.visiveis.map((l) => <CartaoLista key={l.id} lista={l} nota={notas[l.id]} idTurma={idTurma} />)}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {extras.map((l) => <CartaoLista key={l.id} lista={l} nota={notas[l.id]} idTurma={idTurma} contexto={ehNova(l.liberadaEm) ? <Etiqueta tom="coral">Novo</Etiqueta> : undefined} />)}
        </ul>
      )}
    </>
  );
}

// ---------------------------------------------------------------- Ao vivo

function AbaAoVivo({ encontros }: { encontros: Encontros | null }) {
  if (!encontros?.link) {
    return <EstadoVazio icone={Video} titulo="Sem link de aula ao vivo" texto="Quando a professora colocar o link das aulas ao vivo, ele fica aqui, sempre à mão." />;
  }
  return (
    <div className="space-y-6">
      <AulaAoVivo encontros={encontros} />
      {encontros.horarios.length > 0 && (
        <section className="rounded-2xl border border-borda bg-superficie p-5 sm:p-6">
          <h2 className="mb-3 text-lg font-bold text-marca">Horários das aulas</h2>
          <ul className="space-y-1.5 text-sm">
            {resumoHorarios(encontros.horarios).map((r) => <li key={r} className="flex items-center gap-2"><Video className="size-4 text-suave" /> {r}</li>)}
          </ul>
          <p className="mt-3 text-xs text-suave">Horário de Brasília. O botão "Entrar na aula" fica em destaque a partir de 15 minutos antes.</p>
        </section>
      )}
    </div>
  );
}
