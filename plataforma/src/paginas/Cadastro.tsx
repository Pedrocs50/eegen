import { useState, type FormEvent } from "react";
import { useLocation } from "react-router";
import { supabase, traduzirErro } from "../lib/supabase";
import { comVolta, lerVolta } from "../lib/volta";
import { Aviso, Botao, Campo, CartaoAuth, LinkTexto } from "../componentes/ui";

export default function Cadastro() {
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [emailEnviado, setEmailEnviado] = useState("");
  const volta = lerVolta(useLocation().search);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    const senha = String(dados.get("senha"));
    if (senha !== String(dados.get("confirmacao"))) {
      setErro("As senhas não são iguais.");
      return;
    }
    const email = String(dados.get("email")).trim();
    setErro("");
    setEnviando(true);
    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: { nome: String(dados.get("nome")).trim() },
        // O link do e-mail de confirmação já leva para onde a pessoa queria ir (ex.: o exercício compartilhado).
        emailRedirectTo: `${window.location.origin}${volta ?? "/"}`,
      },
    });
    setEnviando(false);
    if (error) setErro(traduzirErro(error.message));
    else setEmailEnviado(email);
  }

  if (emailEnviado) {
    return (
      <CartaoAuth titulo="Confirme seu e-mail" rodape={<LinkTexto para={comVolta("/entrar", volta)}>Voltar para o login</LinkTexto>}>
        <Aviso tipo="sucesso">
          Enviamos um link de confirmação para <strong>{emailEnviado}</strong>. Abra o e-mail e clique no link para ativar sua conta.
        </Aviso>
        <p className="mt-4 text-sm text-suave">Não chegou? Confira a caixa de spam.</p>
      </CartaoAuth>
    );
  }

  return (
    <CartaoAuth
      titulo="Criar conta"
      subtitulo="Depois do cadastro, confirme seu e-mail para entrar."
      rodape={<>Já tem conta? <LinkTexto para={comVolta("/entrar", volta)}>Entrar</LinkTexto></>}
    >
      <form onSubmit={enviar} className="space-y-4">
        {erro && <Aviso>{erro}</Aviso>}
        <Campo rotulo="Nome completo" name="nome" autoComplete="name" placeholder="Maria Souza" required />
        <Campo rotulo="E-mail" name="email" type="email" autoComplete="email" placeholder="voce@email.com" required />
        <Campo rotulo="Senha" name="senha" type="password" autoComplete="new-password" minLength={8} dica="Pelo menos 8 caracteres." required />
        <Campo rotulo="Repita a senha" name="confirmacao" type="password" autoComplete="new-password" minLength={8} required />
        <Botao type="submit" carregando={enviando} className="w-full">Criar conta</Botao>
      </form>
    </CartaoAuth>
  );
}
