import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../lib/auth";
import { supabase, traduzirErro } from "../lib/supabase";
import { Aviso, Botao, Campo, CartaoAuth, LinkTexto } from "../componentes/ui";

export default function NovaSenha() {
  const { sessao } = useAuth();
  const navegar = useNavigate();
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (!sessao) {
    return (
      <CartaoAuth titulo="Link inválido" rodape={<LinkTexto para="/entrar">Voltar para o login</LinkTexto>}>
        <Aviso>
          Este link expirou ou já foi usado. Peça um novo em{" "}
          <Link to="/esqueci-senha" className="font-semibold text-erro underline">Esqueci minha senha</Link>.
        </Aviso>
      </CartaoAuth>
    );
  }

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
    const { error } = await supabase.auth.updateUser({ password: senha });
    setEnviando(false);
    if (error) setErro(traduzirErro(error.message));
    else navegar("/", { replace: true });
  }

  return (
    <CartaoAuth titulo="Criar nova senha">
      <form onSubmit={enviar} className="space-y-4">
        {erro && <Aviso>{erro}</Aviso>}
        <Campo rotulo="Nova senha" name="senha" type="password" autoComplete="new-password" minLength={8} dica="Pelo menos 8 caracteres." required />
        <Campo rotulo="Repita a nova senha" name="confirmacao" type="password" autoComplete="new-password" minLength={8} required />
        <Botao type="submit" carregando={enviando} className="w-full">Salvar senha</Botao>
      </form>
    </CartaoAuth>
  );
}
