import { useAuth } from "../lib/auth";

function EmBreve({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-6">
      <h2 className="font-bold text-marinho-800">{titulo}</h2>
      <p className="mt-1 text-sm text-slate-600">{texto}</p>
      <span className="mt-3 inline-block rounded-full bg-marinho-50 px-2.5 py-0.5 text-xs font-semibold text-marinho-700">Próxima etapa</span>
    </div>
  );
}

function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] || "";
}

export function InicioProfessor() {
  const { perfil } = useAuth();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-marinho-900">Olá, {primeiroNome(perfil?.nome ?? "") || "professor"}</h1>
        <p className="text-slate-600">Aqui você vai criar exercícios e acompanhar suas turmas.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <EmBreve titulo="Exercícios" texto="Crie listening, leitura e gramática com áudio e capa gerados automaticamente." />
        <EmBreve titulo="Turmas" texto="Convide alunos com um código e libere exercícios com data." />
        <EmBreve titulo="Resultados" texto="Veja quem fez, as notas e as questões em que a turma mais errou." />
      </div>
    </div>
  );
}

export function InicioAluno() {
  const { perfil } = useAuth();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-marinho-900">Olá, {primeiroNome(perfil?.nome ?? "") || "aluno"}</h1>
        <p className="text-slate-600">Seus cursos e exercícios aparecem aqui.</p>
      </div>
      <EmBreve titulo="Entrar em uma turma" texto="Use o código que seu professor enviar para acessar os exercícios." />
    </div>
  );
}
