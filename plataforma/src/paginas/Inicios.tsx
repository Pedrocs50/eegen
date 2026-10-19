import type { LucideIcon } from "lucide-react";
import { BarChart3, BookMarked, ClipboardList, PenLine, Sparkles, UsersRound } from "lucide-react";
import { CURSOS_E_TURMAS_ATIVOS } from "../lib/recursos";
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

type Contagens = { listas: number; publicadas: number; respostas: number };

export function InicioProfessor() {
  const { perfil } = useAuth();
  const { dados: contagens } = useConsulta<Contagens>(async () => {
    const [listas, publicadas, respostas] = await Promise.all([
      supabase.from("listas").select("id", { count: "exact", head: true }),
      supabase.from("listas").select("id", { count: "exact", head: true }).eq("status", "publicada"),
      supabase.from("tentativas").select("id", { count: "exact", head: true }),
    ]);
    const erro = listas.error ?? publicadas.error ?? respostas.error;
    return { data: { listas: listas.count ?? 0, publicadas: publicadas.count ?? 0, respostas: respostas.count ?? 0 }, error: erro };
  });

  return (
    <>
      <CabecalhoPagina
        etiqueta="Área do professor"
        titulo={`Olá, ${primeiroNome(perfil?.nome ?? "") || "professor"}!`}
        descricao="Crie listas de exercícios, publique para os alunos e acompanhe as respostas."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Atalho para="/exercicios/nova" icone={Sparkles} titulo="Criar com o Assistente UP" texto="Peça os exercícios em uma frase, inclusive listening com áudio." />
        <Atalho
          para="/exercicios"
          icone={ClipboardList}
          titulo="Exercícios"
          numero={contagens?.listas}
          texto={`${contagens?.publicadas ?? 0} publicadas para os alunos. Edite, publique ou teste como aluno.`}
        />
        <Atalho para="/praticar" icone={PenLine} titulo="Visão do aluno" numero={contagens?.respostas} texto="Respostas enviadas até agora. Veja as listas como o aluno vê." />
        <EmBreve icone={BarChart3} titulo="Resultados" texto="Quem fez, as notas e as questões em que a turma mais errou." />
      </div>
      {perfil?.papel === "admin" && !CURSOS_E_TURMAS_ATIVOS && (
        <>
          <h2 className="mt-10 mb-1 text-xl font-bold text-marca">Em construção</h2>
          <p className="mb-4 text-sm text-suave">Só você (admin) vê estas partes. Professores e alunos ainda não.</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Atalho para="/cursos" icone={BookMarked} titulo="Cursos e aulas" texto="Cursos por idioma e nível, com as aulas e o material de cada uma." />
            <Atalho para="/turmas" icone={UsersRound} titulo="Turmas" texto="Turmas com código de convite e aulas liberadas por turma." />
          </div>
        </>
      )}
    </>
  );
}
