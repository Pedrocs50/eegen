import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { CheckCircle2, Hourglass } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase, traduzirErro } from "../lib/supabase";
import { Aviso, Carregando, CartaoAuth, LinkTexto } from "../componentes/ui";
import Cadastro from "./Cadastro";

/**
 * Link de convite da turma (/convite/CODIGO). Sem login: cadastro com o código preenchido.
 * Logado: registra o pedido de entrada na turma e avisa que falta a aprovação da professora.
 */
export default function Convite() {
  const { codigo = "" } = useParams();
  const { sessao, perfil, carregando } = useAuth();

  if (carregando) return <Carregando />;
  if (!sessao) return <Cadastro codigoInicial={codigo} />;
  if (perfil && perfil.papel !== "aluno") {
    return (
      <CartaoAuth titulo="Convite de turma" rodape={<LinkTexto para="/turmas">Ir para as turmas</LinkTexto>}>
        <Aviso tipo="info">Este é o link que os alunos usam para entrar na turma. Como você é da equipe, não precisa entrar por ele.</Aviso>
      </CartaoAuth>
    );
  }
  return <PedirEntrada codigo={codigo} />;
}

function PedirEntrada({ codigo }: { codigo: string }) {
  const [estado, setEstado] = useState<{ erro?: string; turma?: string; aprovada?: boolean } | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data: idTurma, error } = await supabase.rpc("entrar_na_turma", { codigo_turma: codigo });
      if (!ativo) return;
      if (error) return setEstado({ erro: traduzirErro(error.message) });
      const { data } = await supabase.from("matriculas").select("situacao, turmas(nome)").eq("turma_id", idTurma).maybeSingle();
      const linha = data as unknown as { situacao: string; turmas: { nome: string } | null } | null;
      if (ativo) setEstado({ turma: linha?.turmas?.nome ?? "", aprovada: linha?.situacao === "aprovada" });
    })();
    return () => {
      ativo = false;
    };
  }, [codigo]);

  if (!estado) return <Carregando />;
  return (
    <CartaoAuth titulo={estado.erro ? "Não deu para entrar" : estado.aprovada ? "Você já está na turma" : "Pedido enviado"} rodape={<LinkTexto para="/aluno">Ir para minhas turmas</LinkTexto>}>
      {estado.erro ? (
        <Aviso>{estado.erro}</Aviso>
      ) : estado.aprovada ? (
        <p className="flex items-start gap-2 text-texto"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-sucesso" /> Você já faz parte da turma <strong>{estado.turma}</strong>.</p>
      ) : (
        <p className="flex items-start gap-2 text-texto">
          <Hourglass className="mt-0.5 size-5 shrink-0 text-destaque" />
          <span>Seu pedido para entrar na turma <strong>{estado.turma}</strong> foi enviado. Assim que a professora aprovar, as aulas e os exercícios aparecem em <Link to="/aluno" className="font-semibold underline">Minhas turmas</Link>.</span>
        </p>
      )}
    </CartaoAuth>
  );
}
