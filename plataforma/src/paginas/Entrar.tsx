import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { comVolta, lerVolta } from "../lib/volta";
import { supabase, traduzirErro } from "../lib/supabase";
import { Aviso, Botao, Campo, CartaoAuth, LinkTexto } from "../componentes/ui";
import BotaoGoogle, { SeparadorOu } from "../componentes/BotaoGoogle";

export default function Entrar() {
  const navegar = useNavigate();
  const volta = lerVolta(useLocation().search);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    setErro("");
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(dados.get("email")).trim(),
      password: String(dados.get("senha")),
    });
    setEnviando(false);
    if (error) setErro(traduzirErro(error.message));
    else navegar(volta ?? "/", { replace: true });
  }

  return (
    <CartaoAuth
      titulo="Entrar"
      subtitulo="Acesse seus exercícios e listenings."
      rodape={<>Ainda não tem conta? <LinkTexto para={comVolta("/cadastro", volta)}>Criar conta</LinkTexto></>}
    >
      <div className="space-y-5">
        <BotaoGoogle destino={volta ?? "/"} />
        <SeparadorOu texto="ou entre com e-mail" />
      </div>
      <form onSubmit={enviar} className="mt-5 space-y-4">
        {erro && <Aviso>{erro}</Aviso>}
        <Campo rotulo="E-mail" name="email" type="email" autoComplete="email" placeholder="voce@email.com" required />
        <Campo rotulo="Senha" name="senha" type="password" autoComplete="current-password" required />
        <div className="text-right text-sm">
          <Link to="/esqueci-senha" className="font-semibold text-destaque hover:underline">Esqueci minha senha</Link>
        </div>
        <Botao type="submit" carregando={enviando} className="w-full">Entrar</Botao>
      </form>
    </CartaoAuth>
  );
}
