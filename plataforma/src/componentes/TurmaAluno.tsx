import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { useAuth } from "../lib/auth";
import { CheckCircle2, Headphones, Hourglass, KeyRound } from "lucide-react";
import { supabase, traduzirErro } from "../lib/supabase";
import { IDIOMAS, nomeNivel, useConsulta } from "../lib/dados";
import { buscarTurmasDoAluno, escolherTurma, lembrarTurma, type ListaDaTurma, type TurmaDoAluno } from "../lib/turmas";
import { Aviso, Botao, Cartao, Etiqueta } from "./ui";

export function Pilula({ ativa, onClick, children }: { ativa: boolean; onClick: () => void; children: ReactNode }) {
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

export function BarraProgresso({ feitas, total, rotulo }: { feitas: number; total: number; rotulo: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-borda" role="progressbar" aria-label={rotulo} aria-valuenow={feitas} aria-valuemin={0} aria-valuemax={total}>
      <div className="h-full rounded-full bg-sucesso transition-[width]" style={{ width: `${total ? (feitas / total) * 100 : 0}%` }} />
    </div>
  );
}

/** Card de uma lista de exercícios, com a situação (feita e a melhor nota, ou não feita). */
export function CartaoLista({ lista, nota, contexto, idTurma }: { lista: ListaDaTurma; nota: number | undefined; contexto?: ReactNode; idTurma?: string }) {
  const temAudio = lista.secoes.some((s) => s.tipo_estimulo === "audio");
  return (
    <li>
      <Link to={`/praticar/${lista.id}${idTurma ? `?turma=${idTurma}` : ""}`} className="flex h-full flex-col rounded-2xl border border-borda bg-superficie p-5 transition hover:border-destaque hover:shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {temAudio && <Etiqueta><Headphones className="mr-1 size-3.5" /> Listening</Etiqueta>}
          {nota !== undefined ? (
            <Etiqueta tom="verde"><CheckCircle2 className="mr-1 size-3.5" /> Feita · {nota}%</Etiqueta>
          ) : (
            <Etiqueta tom="creme">Não feita</Etiqueta>
          )}
          {contexto}
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

/** Troca de turma, quando o aluno está em mais de uma (ex.: inglês e espanhol). */
export function SeletorTurma({ turmas, atual, aoEscolher }: { turmas: TurmaDoAluno[]; atual: TurmaDoAluno; aoEscolher: (id: string) => void }) {
  const aprovadas = turmas.filter((t) => t.situacao === "aprovada");
  if (aprovadas.length < 2) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2" role="group" aria-label="Escolher turma">
      <span className="mr-1 text-[11px] font-bold tracking-[0.12em] text-suave uppercase">Turma</span>
      {aprovadas.map((t) => (
        <Pilula key={t.id} ativa={t.id === atual.id} onClick={() => aoEscolher(t.id)}>
          {t.nome}{t.curso ? ` · ${IDIOMAS[t.curso.idioma]}` : ""}
        </Pilula>
      ))}
    </div>
  );
}

export const descricaoDaTurma = (t: TurmaDoAluno) =>
  t.curso ? `${IDIOMAS[t.curso.idioma]} · ${nomeNivel(t.curso.idioma, t.curso.nivel)}${t.professor ? ` · com ${t.professor}` : ""}` : "";

/** Pedidos de entrada que a professora ainda não aprovou. */
export function PedidosPendentes({ turmas }: { turmas: TurmaDoAluno[] }) {
  const pendentes = turmas.filter((t) => t.situacao === "pendente");
  if (pendentes.length === 0) return null;
  return (
    <div className="mb-6 space-y-2">
      {pendentes.map((t) => (
        <div key={t.id} className="flex items-start gap-3 rounded-2xl border border-destaque/40 bg-destaque-suave p-4">
          <Hourglass className="mt-0.5 size-5 shrink-0 text-marca" />
          <p className="text-sm text-texto">
            Pedido para entrar na turma <strong>{t.nome}</strong> enviado. Assim que a professora aprovar, as aulas e os exercícios aparecem aqui.
          </p>
        </div>
      ))}
    </div>
  );
}

/** Entrar em uma turma pelo código (o pedido fica aguardando a professora). */
export function EntrarNaTurma({ aoEntrar, destaque }: { aoEntrar: () => void; destaque: boolean }) {
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
          <h2 className="text-lg font-bold text-marca">{destaque ? "Entre na sua turma" : "Entrar em outra turma"}</h2>
          <p className="text-sm text-suave">Digite o código de 6 caracteres que a sua professora enviou. Ela aprova a sua entrada.</p>
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
              className="h-12 rounded-xl border border-borda bg-superficie px-4 font-mono text-lg font-bold tracking-[0.3em] uppercase placeholder:font-normal placeholder:tracking-[0.3em] placeholder:text-suave/50 focus:border-destaque focus:ring-4 focus:ring-destaque-suave focus:outline-none sm:w-48"
            />
            <Botao type="submit" carregando={enviando} className="h-12">Pedir para entrar</Botao>
          </form>
          {erro && <div className="mt-3"><Aviso>{erro}</Aviso></div>}
        </div>
      </div>
    </Cartao>
  );
}

/**
 * Turmas da pessoa e a turma escolhida (pela URL ?turma=, pela última aberta ou a primeira aprovada).
 * Usado pela "Minha turma" e pelos "Exercícios" do aluno.
 */
export function useTurmasDoAluno() {
  const { perfil } = useAuth();
  const [parametros, setParametros] = useSearchParams();
  const consulta = useConsulta<TurmaDoAluno[]>(
    () => buscarTurmasDoAluno(perfil?.id ?? "", perfil?.papel ?? "aluno"),
    [perfil?.id, perfil?.papel],
  );
  const turmas = consulta.dados ?? [];
  const atual = escolherTurma(turmas, parametros.get("turma"));
  const idAtual = atual?.id;
  useEffect(() => {
    if (idAtual) lembrarTurma(idAtual);
  }, [idAtual]);
  const escolher = (id: string) => {
    const novos = new URLSearchParams(parametros);
    novos.set("turma", id);
    setParametros(novos, { replace: true });
  };
  return { ...consulta, turmas, atual, escolher };
}
