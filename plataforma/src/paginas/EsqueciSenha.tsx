import { useState, type FormEvent } from "react";
import { supabase, traduzirErro } from "../lib/supabase";
import { Aviso, Botao, Campo, CartaoAuth, LinkTexto } from "../componentes/ui";

export default function EsqueciSenha() {
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const email = String(new FormData(evento.currentTarget).get("email")).trim();
    setErro("");
    setEnviando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nova-senha`,
    });
    setEnviando(false);
    if (error) setErro(traduzirErro(error.message));
    else setEnviado(true);
  }

  return (
    <CartaoAuth
      titulo="Recuperar senha"
      subtitulo="Enviaremos um link para você criar uma senha nova."
      rodape={<LinkTexto para="/entrar">Voltar para o login</LinkTexto>}
    >
      {enviado ? (
        <Aviso tipo="sucesso">Se existir uma conta com esse e-mail, o link já está a caminho. Confira também o spam.</Aviso>
      ) : (
        <form onSubmit={enviar} className="space-y-4">
          {erro && <Aviso>{erro}</Aviso>}
          <Campo rotulo="E-mail" name="email" type="email" autoComplete="email" placeholder="voce@email.com" required />
          <Botao type="submit" carregando={enviando} className="w-full">Enviar link</Botao>
        </form>
      )}
    </CartaoAuth>
  );
}
