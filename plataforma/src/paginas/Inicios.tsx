import type { LucideIcon } from "lucide-react";
import { BarChart3, ClipboardList, KeyRound, NotebookPen, Users } from "lucide-react";
import { useAuth } from "../lib/auth";
import { CabecalhoPagina } from "../componentes/Painel";

function EmBreve({ icone: Icone, titulo, texto }: { icone: LucideIcon; titulo: string; texto: string }) {
  return (
    <div className="rounded-2xl border border-borda bg-superficie p-6">
      <span className="grid size-11 place-items-center rounded-xl bg-destaque-suave text-marca"><Icone className="size-5" /></span>
      <h2 className="mt-4 text-lg font-bold text-marca">{titulo}</h2>
      <p className="mt-1 text-sm text-suave">{texto}</p>
      <span className="mt-4 inline-block rounded-full bg-creme px-2.5 py-1 text-xs font-semibold text-suave">Próxima etapa</span>
    </div>
  );
}

function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] || "";
}

export function InicioProfessor() {
  const { perfil } = useAuth();
  return (
    <>
      <CabecalhoPagina
        etiqueta="Área do professor"
        titulo={`Olá, ${primeiroNome(perfil?.nome ?? "") || "professor"}!`}
        descricao="Aqui você vai montar as aulas, criar as listas de exercícios e acompanhar suas turmas."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <EmBreve icone={NotebookPen} titulo="Aulas" texto="Organize os cursos por nível e anexe o material de cada aula." />
        <EmBreve icone={ClipboardList} titulo="Listas de exercícios" texto="Lacunas, múltipla escolha, por extenso e listening, com capa e áudio gerados." />
        <EmBreve icone={Users} titulo="Turmas" texto="Convide alunos com um código e libere as listas com data." />
        <EmBreve icone={BarChart3} titulo="Resultados" texto="Veja quem fez, as notas e as questões em que a turma mais errou." />
      </div>
    </>
  );
}

export function InicioAluno() {
  const { perfil } = useAuth();
  return (
    <>
      <CabecalhoPagina
        etiqueta="Meus estudos"
        titulo={`Olá, ${primeiroNome(perfil?.nome ?? "") || "aluno"}!`}
        descricao="Seus cursos, aulas e listas de exercícios aparecem aqui."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <EmBreve icone={KeyRound} titulo="Entrar em uma turma" texto="Use o código que a sua professora enviar para liberar as aulas e os exercícios." />
      </div>
    </>
  );
}
