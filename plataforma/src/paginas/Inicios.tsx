import type { LucideIcon } from "lucide-react";
import { BarChart3, BookMarked, ClipboardList, Users } from "lucide-react";
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

function EmBreve({ icone: Icone, titulo, texto }: { icone: LucideIcon; titulo: string; texto: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-borda p-6">
      <span className="grid size-11 place-items-center rounded-xl bg-creme text-suave"><Icone className="size-5" /></span>
      <h2 className="mt-4 text-lg font-bold text-marca">{titulo}</h2>
      <p className="mt-1 text-sm text-suave">{texto}</p>
      <span className="mt-4 inline-block rounded-full bg-creme px-2.5 py-1 text-xs font-semibold text-suave">Próxima etapa</span>
    </div>
  );
}

type Contagens = { cursos: number; turmas: number; alunos: number };

export function InicioProfessor() {
  const { perfil } = useAuth();
  const { dados: contagens } = useConsulta<Contagens>(async () => {
    const [cursos, turmas, alunos] = await Promise.all([
      supabase.from("cursos").select("id", { count: "exact", head: true }),
      supabase.from("turmas").select("id", { count: "exact", head: true }),
      supabase.from("matriculas").select("aluno_id", { count: "exact", head: true }),
    ]);
    const erro = cursos.error ?? turmas.error ?? alunos.error;
    return { data: { cursos: cursos.count ?? 0, turmas: turmas.count ?? 0, alunos: alunos.count ?? 0 }, error: erro };
  });

  return (
    <>
      <CabecalhoPagina
        etiqueta="Área do professor"
        titulo={`Olá, ${primeiroNome(perfil?.nome ?? "") || "professor"}!`}
        descricao="Monte os cursos e as aulas, abra turmas e escolha o que cada turma pode ver."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Atalho para="/cursos" icone={BookMarked} titulo="Cursos" numero={contagens?.cursos} texto="Cursos por idioma e nível, com as aulas dentro." />
        <Atalho para="/turmas" icone={Users} titulo="Turmas" numero={contagens?.turmas} texto={`${contagens?.alunos ?? 0} matrículas no total. Libere aulas para cada turma.`} />
        <EmBreve icone={ClipboardList} titulo="Listas de exercícios" texto="Lacunas, múltipla escolha, por extenso e listening, com capa e áudio." />
        <EmBreve icone={BarChart3} titulo="Resultados" texto="Quem fez, as notas e as questões em que a turma mais errou." />
      </div>
    </>
  );
}
