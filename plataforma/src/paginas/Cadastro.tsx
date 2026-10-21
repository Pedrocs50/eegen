import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "react-router";
import { CheckCircle2 } from "lucide-react";
import { supabase, traduzirErro } from "../lib/supabase";
import { comVolta, lerVolta } from "../lib/volta";
import { IDIOMAS, type Idioma } from "../lib/dados";
import { Aviso, Botao, Campo, CartaoAuth, LinkTexto } from "../componentes/ui";
import BotaoGoogle, { SeparadorOu } from "../componentes/BotaoGoogle";

type InfoTurma = { turma: string; curso: string; idioma: Idioma; professor: string | null };

async function conferirCodigo(codigo: string): Promise<InfoTurma | null> {
  const { data } = await supabase.rpc("conferir_codigo_turma", { codigo_turma: codigo });
  return (data as InfoTurma | null) ?? null;
}

/**
 * Cadastro só com o código da turma: a plataforma é para os alunos da Teacher Monique.
 * O código vai junto no cadastro e o banco já registra o pedido de entrada, que a professora aprova.
 */
export default function Cadastro({ codigoInicial = "" }: { codigoInicial?: string }) {
  const local = useLocation();
  const volta = lerVolta(local.search);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [emailEnviado, setEmailEnviado] = useState("");
  const [codigo, setCodigo] = useState((codigoInicial || new URLSearchParams(local.search).get("codigo") || "").toUpperCase());
  const [turma, setTurma] = useState<InfoTurma | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const [codigoConferido, setCodigoConferido] = useState("");

  async function conferir(valor = codigo): Promise<InfoTurma | null> {
    const limpo = valor.trim().toUpperCase();
    if (limpo.length !== 6) {
      setTurma(null);
      return null;
    }
    if (limpo === codigoConferido) return turma;
    setConferindo(true);
    const info = await conferirCodigo(limpo);
    setConferindo(false);
    setTurma(info);
    setCodigoConferido(limpo);
    return info;
  }

  // Confere o código que veio no link assim que a tela abre.
  useEffect(() => {
    if (codigo.length === 6) void conferir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    const senha = String(dados.get("senha"));
    if (senha !== String(dados.get("confirmacao"))) {
      setErro("As senhas não são iguais.");
      return;
    }
    setErro("");
    setEnviando(true);
    const info = await conferir();
    if (!info) {
      setEnviando(false);
      setErro("Código de turma não encontrado. Confira com a sua professora (são 6 letras e números).");
      return;
    }
    const email = String(dados.get("email")).trim();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: { nome: String(dados.get("nome")).trim(), codigo_turma: codigo.trim().toUpperCase() },
        // O link do e-mail de confirmação já leva para onde a pessoa queria ir (ex.: o exercício compartilhado).
        emailRedirectTo: `${window.location.origin}${volta ?? "/"}`,
      },
    });
    setEnviando(false);
    if (error) setErro(traduzirErro(error.message));
    // Com a confirmação de e-mail desligada no Supabase, a conta já vem logada e a rota leva a pessoa adiante.
    else if (!data.session) setEmailEnviado(email);
  }

  if (emailEnviado) {
    return (
      <CartaoAuth titulo="Confirme seu e-mail" rodape={<LinkTexto para={comVolta("/entrar", volta)}>Voltar para o login</LinkTexto>}>
        <Aviso tipo="sucesso">
          Enviamos um link de confirmação para <strong>{emailEnviado}</strong>. Abra o e-mail e clique no link para ativar sua conta.
        </Aviso>
        <p className="mt-4 text-sm text-suave">
          Seu pedido para entrar na turma <strong>{turma?.turma}</strong> já foi enviado. Assim que a professora aprovar, os exercícios aparecem para você.
        </p>
        <p className="mt-2 text-sm text-suave">Não chegou o e-mail? Confira a caixa de spam.</p>
      </CartaoAuth>
    );
  }

  return (
    <CartaoAuth
      titulo="Criar conta"
      subtitulo="A plataforma é exclusiva para alunos da UP English. Use o código da turma que a professora enviou."
      rodape={<>Já tem conta? <LinkTexto para={comVolta("/entrar", volta)}>Entrar</LinkTexto></>}
    >
      <form onSubmit={enviar} className="space-y-4">
        {erro && <Aviso>{erro}</Aviso>}
        <div>
          <Campo
            rotulo="Código da turma"
            name="codigo"
            value={codigo}
            onChange={(e) => {
              const valor = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
              setCodigo(valor);
              if (valor.length === 6) void conferir(valor);
              else setTurma(null);
            }}
            autoComplete="off"
            placeholder="K7Q2PB"
            minLength={6}
            maxLength={6}
            required
            className="font-mono tracking-[0.3em] uppercase"
          />
          {conferindo && <p className="mt-1.5 text-sm text-suave">Conferindo o código…</p>}
          {!conferindo && turma && (
            <p className="mt-2 flex items-start gap-2 rounded-xl bg-sucesso-suave px-3 py-2 text-sm text-texto">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-sucesso" />
              <span>
                Turma <strong>{turma.turma}</strong> · {turma.curso} ({IDIOMAS[turma.idioma]}){turma.professor ? ` · com ${turma.professor}` : ""}
              </span>
            </p>
          )}
          {!conferindo && !turma && codigoConferido && codigo === codigoConferido && (
            <p className="mt-1.5 text-sm text-erro">Código não encontrado. Confira com a sua professora.</p>
          )}
        </div>
        {/* Pelo Google, a pessoa volta para o convite da turma, que já registra o pedido de entrada. */}
        <BotaoGoogle destino={`/convite/${codigo.trim().toUpperCase()}`} desabilitado={!turma} dica="Digite o código da turma acima para continuar com o Google." />
        <SeparadorOu texto="ou crie a conta com e-mail" />
        <Campo rotulo="Nome completo" name="nome" autoComplete="name" placeholder="Maria Souza" required />
        <Campo rotulo="E-mail" name="email" type="email" autoComplete="email" placeholder="voce@email.com" required />
        <Campo rotulo="Senha" name="senha" type="password" autoComplete="new-password" minLength={8} dica="Pelo menos 8 caracteres." required />
        <Campo rotulo="Repita a senha" name="confirmacao" type="password" autoComplete="new-password" minLength={8} required />
        <Botao type="submit" carregando={enviando} className="w-full">Criar conta e pedir para entrar</Botao>
      </form>
    </CartaoAuth>
  );
}
