import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Plus, Users } from "lucide-react";
import { supabase, traduzirErro } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { IDIOMAS, nomeNivel, useConsulta, type Curso, type Turma } from "../lib/dados";
import { CabecalhoPagina } from "../componentes/Painel";
import CopiarTexto from "../componentes/CopiarTexto";
import { mensagemDeConvite } from "../lib/turmas";
import { Aviso, Botao, Campo, CampoSelecao, Cartao, Etiqueta, EstadoVazio, TextoCarregando } from "../componentes/ui";

type TurmaResumo = Turma & { cursos: Pick<Curso, "titulo" | "idioma" | "nivel">; matriculas: { situacao: "pendente" | "aprovada" }[]; aulas_liberadas: { count: number }[]; professor: { nome: string } | null };

/** Cria a turma e abre a página dela. Avisa se já existe uma com o mesmo nome (para não criar duas sem querer). */
function FormularioTurma({ nomesExistentes, aoSalvar, aoCancelar }: { nomesExistentes: string[]; aoSalvar: (idNova?: string) => void; aoCancelar: () => void }) {
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const { dados: cursos } = useConsulta<Curso[]>(() => supabase.from("cursos").select("*").order("idioma").order("nivel"));

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    const nome = String(dados.get("nome")).trim();
    const cursoId = String(dados.get("curso_id"));
    setErro("");
    if (nomesExistentes.some((n) => n.trim().toLowerCase() === nome.toLowerCase())) {
      setErro(`Você já tem uma turma chamada "${nome}". Procure na lista abaixo ou escolha outro nome.`);
      return;
    }
    setSalvando(true);
    const { error } = await supabase.from("turmas").insert({ nome, curso_id: cursoId });
    if (error) {
      setSalvando(false);
      setErro(traduzirErro(error.message));
      return;
    }
    // Busca a turma recém-criada para abrir a página dela (um pedido separado: funciona mesmo antes da migração 0014).
    const { data: nova } = await supabase.from("turmas").select("id").eq("curso_id", cursoId).eq("nome", nome).order("criado_em", { ascending: false }).limit(1).maybeSingle();
    setSalvando(false);
    aoSalvar((nova as { id: string } | null)?.id);
  }

  if (cursos && cursos.length === 0) {
    return <Aviso tipo="info">Crie um curso antes de abrir uma turma. <Link to="/cursos" className="font-semibold underline">Ir para cursos</Link></Aviso>;
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      {erro && <Aviso>{erro}</Aviso>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Nome da turma" name="nome" placeholder="Beginner · terças à noite" required />
        <CampoSelecao rotulo="Curso" name="curso_id" required defaultValue="">
          <option value="" disabled>Escolha o curso</option>
          {cursos?.map((c) => (
            <option key={c.id} value={c.id}>{c.titulo} ({IDIOMAS[c.idioma]} · {nomeNivel(c.idioma, c.nivel)})</option>
          ))}
        </CampoSelecao>
      </div>
      <div className="flex flex-wrap gap-2">
        <Botao type="submit" carregando={salvando}>Criar turma</Botao>
        <Botao type="button" variante="secundario" onClick={aoCancelar}>Cancelar</Botao>
      </div>
    </form>
  );
}

export default function Turmas() {
  const [criando, setCriando] = useState(false);
  const navegar = useNavigate();
  const { perfil } = useAuth();
  const { dados: turmas, erro, carregando, recarregar } = useConsulta<TurmaResumo[]>(() =>
    supabase.from("turmas").select("*, cursos(titulo, idioma, nivel), matriculas(situacao), aulas_liberadas(count), professor:perfis!professor_id(nome)").order("criado_em", { ascending: false }),
  );
  const botaoNova = <Botao onClick={() => setCriando(true)}><Plus className="size-4" /> Nova turma</Botao>;

  return (
    <>
      <CabecalhoPagina
        etiqueta="Ensino"
        titulo="Turmas"
        descricao="Cada turma segue um curso da biblioteca. Os alunos pedem para entrar pelo link de convite, você aprova e libera as aulas conforme elas acontecem."
        acoes={!criando && turmas && turmas.length > 0 ? botaoNova : undefined}
      />

      {criando && (
        <Cartao className="mb-6">
          <h2 className="mb-4 text-xl font-bold text-marca">Nova turma</h2>
          <FormularioTurma
            nomesExistentes={(turmas ?? []).filter((t) => t.professor_id === perfil?.id).map((t) => t.nome)}
            aoCancelar={() => setCriando(false)}
            aoSalvar={(idNova) => {
              setCriando(false);
              if (idNova) navegar(`/turmas/${idNova}`);
              else recarregar();
            }}
          />
        </Cartao>
      )}

      {erro && <Aviso>{erro}</Aviso>}
      {carregando && <TextoCarregando />}

      {turmas && turmas.length === 0 && !criando && (
        <EstadoVazio
          icone={Users}
          titulo="Abra a primeira turma"
          texto="A turma gera um link de convite. Os alunos pedem para entrar por ele e você aprova quem é da turma."
          acao={botaoNova}
        />
      )}

      {turmas && turmas.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {turmas.map((turma) => {
            const alunos = turma.matriculas.filter((m) => m.situacao === "aprovada").length;
            const pedidos = turma.matriculas.length - alunos;
            const aulasLiberadas = turma.aulas_liberadas[0]?.count ?? 0;
            return (
              <li key={turma.id} className="relative">
                <Link to={`/turmas/${turma.id}`} className="flex h-full flex-col rounded-2xl border border-borda bg-superficie p-5 transition hover:border-destaque hover:shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <Etiqueta>{IDIOMAS[turma.cursos.idioma]} · {nomeNivel(turma.cursos.idioma, turma.cursos.nivel)}</Etiqueta>
                    <span className="flex gap-1.5">
                      {pedidos > 0 && <Etiqueta tom="coral">{pedidos} {pedidos === 1 ? "pedido" : "pedidos"}</Etiqueta>}
                      {!turma.ativa && <Etiqueta tom="creme">Entradas encerradas</Etiqueta>}
                    </span>
                  </div>
                  <h2 className="mt-4 text-xl font-bold text-marca">{turma.nome}</h2>
                  <p className="text-sm text-suave">{turma.cursos.titulo}</p>
                  {perfil?.papel === "admin" && turma.professor_id !== perfil.id && (
                    <p className="mt-1 text-xs text-suave">Turma de {turma.professor?.nome || "outra professora"}</p>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-5 text-sm">
                    <span className="text-suave">{alunos} {alunos === 1 ? "aluno" : "alunos"} · {aulasLiberadas} {aulasLiberadas === 1 ? "aula liberada" : "aulas liberadas"}</span>
                    <span className="mr-10 rounded-lg bg-creme px-2.5 py-1 font-mono font-bold tracking-widest text-marca">{turma.codigo}</span>
                  </div>
                </Link>
                <CopiarTexto texto={mensagemDeConvite(turma.nome, turma.codigo)} compacto dica="Copiar convite da turma (link e código)" className="absolute right-4 bottom-4" />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
