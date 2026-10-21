import type { LucideIcon } from "lucide-react";
import { BarChart3, BookMarked, ClipboardList, FileStack, PenLine, Sparkles, UserPlus, UsersRound } from "lucide-react";
import { Link } from "react-router";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { useConsulta } from "../lib/dados";
import { CabecalhoPagina } from "../componentes/Painel";

function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] || "";
}

function Atalho({ para, icone: Icone, titulo, numero, texto }: { para: string; icone: LucideIcon; titulo: string; numero?: number; texto: string }) {
  return (
    <Link to={para} className="flex flex-col rounded-2xl border border-borda bg-superficie p-6 transition hover:border-destaque hover:shadow-sm">
      <div className="flex items-center justify-between">
        <span className="grid size-11 place-items-center rounded-xl bg-destaque-suave text-marca"><Icone className="size-5" /></span>
        {numero !== undefined && <span className="font-serif text-3xl font-bold text-marca">{numero}</span>}
      </div>
      <h2 className="mt-4 text-lg font-bold text-marca">{titulo}</h2>
      <p className="mt-1 text-sm text-suave">{texto}</p>
    </Link>
  );
}

type Contagens = { listas: number; publicadas: number; cursos: number; turmas: number; pedidos: { turma_id: string; turmas: { nome: string } | null }[] };

export function InicioProfessor() {
  const { perfil } = useAuth();
  const { dados: contagens } = useConsulta<Contagens>(async () => {
    const [listas, publicadas, cursos, turmas, pedidos] = await Promise.all([
      supabase.from("listas").select("id", { count: "exact", head: true }),
      supabase.from("listas").select("id", { count: "exact", head: true }).eq("status", "publicada"),
      supabase.from("cursos").select("id", { count: "exact", head: true }),
      supabase.from("turmas").select("id", { count: "exact", head: true }),
      supabase.from("matriculas").select("turma_id, turmas(nome)").eq("situacao", "pendente"),
    ]);
    const erro = listas.error ?? publicadas.error ?? cursos.error ?? turmas.error ?? pedidos.error;
    return {
      data: {
        listas: listas.count ?? 0,
        publicadas: publicadas.count ?? 0,
        cursos: cursos.count ?? 0,
        turmas: turmas.count ?? 0,
        pedidos: (pedidos.data ?? []) as unknown as Contagens["pedidos"],
      },
      error: erro,
    };
  });

  // Pedidos para entrar, agrupados por turma.
  const porTurma = new Map<string, { nome: string; quantos: number }>();
  for (const p of contagens?.pedidos ?? []) {
    const atual = porTurma.get(p.turma_id) ?? { nome: p.turmas?.nome ?? "Turma", quantos: 0 };
    porTurma.set(p.turma_id, { ...atual, quantos: atual.quantos + 1 });
  }

  return (
    <>
      <CabecalhoPagina
        etiqueta="Área do professor"
        titulo={`Olá, ${primeiroNome(perfil?.nome ?? "") || "professor"}!`}
        descricao="Suas turmas, o material das aulas e os exercícios, num lugar só."
      />

      {porTurma.size > 0 && (
        <div className="mb-8 rounded-2xl border-2 border-coral/50 bg-coral-suave p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-marca"><UserPlus className="size-5" /> Alunos pedindo para entrar</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {[...porTurma.entries()].map(([id, t]) => (
              <li key={id}>
                <Link to={`/turmas/${id}?aba=alunos`} className="inline-flex items-center gap-2 rounded-xl bg-superficie px-4 py-2 text-sm font-semibold text-marca hover:shadow-sm">
                  {t.nome} <span className="rounded-full bg-coral px-2 py-0.5 text-xs text-white">{t.quantos}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="mb-3 text-[11px] font-bold tracking-[0.14em] text-suave uppercase">Dia a dia</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Atalho para="/turmas" icone={UsersRound} titulo="Turmas" numero={contagens?.turmas} texto="Libere as aulas, mande exercícios extras e aprove quem pediu para entrar." />
        <Atalho para="/resultados" icone={BarChart3} titulo="Resultados" texto="Quem fez, as notas e as questões em que os alunos mais erram." />
        <Atalho para="/exercicios/nova" icone={Sparkles} titulo="Criar com o Assistente UP" texto="Peça os exercícios em uma frase, inclusive listening com áudio." />
      </div>

      <h2 className="mt-10 mb-3 text-[11px] font-bold tracking-[0.14em] text-suave uppercase">Biblioteca</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Atalho para="/biblioteca" icone={FileStack} titulo="Aulas em PDF" texto="Os slides das aulas, guardados uma vez só. Envie vários de uma vez e use em qualquer curso." />
        <Atalho para="/cursos" icone={BookMarked} titulo="Cursos e aulas" numero={contagens?.cursos} texto="O material de cada aula (PDF) e os exercícios dela. Um curso serve a várias turmas." />
        <Atalho
          para="/exercicios"
          icone={ClipboardList}
          titulo="Exercícios"
          numero={contagens?.listas}
          texto={`${contagens?.publicadas ?? 0} publicadas. O aluno só vê as que estão numa aula liberada ou nos extras da turma dele.`}
        />
        <Atalho para="/aluno" icone={PenLine} titulo="Visão do aluno" texto="Veja uma turma exatamente como os alunos dela veem." />
      </div>
    </>
  );
}
