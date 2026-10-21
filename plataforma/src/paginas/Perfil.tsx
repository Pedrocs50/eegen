import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Bell, CheckCircle2, KeyRound, Mail } from "lucide-react";
import { useAuth } from "../lib/auth";
import { NOMES_PAPEIS, supabase, traduzirErro } from "../lib/supabase";
import { CabecalhoPagina } from "../componentes/Painel";
import Avatar from "../componentes/Avatar";
import { Aviso, Botao, Campo, Cartao, Etiqueta } from "../componentes/ui";

/** Meu perfil: o nome, a forma de entrar (e a senha, quando há) e o atalho das notificações. */
export default function Perfil() {
  const { perfil, sessao, recarregarPerfil } = useAuth();
  if (!perfil || !sessao) return null;

  // Como a pessoa entra: pelo Google, por e-mail e senha, ou pelos dois.
  const provedores = (sessao.user.app_metadata?.providers as string[] | undefined) ?? [sessao.user.app_metadata?.provider as string];
  const temSenha = provedores.includes("email");
  const comGoogle = provedores.includes("google");

  return (
    <>
      <CabecalhoPagina etiqueta="Conta" titulo="Meu perfil" descricao="Seus dados e a forma de entrar na plataforma." />
      <div className="max-w-2xl space-y-6">
        <Dados nomeAtual={perfil.nome} idPerfil={perfil.id} aoSalvar={recarregarPerfil} papel={NOMES_PAPEIS[perfil.papel]} email={perfil.email} comGoogle={comGoogle} temSenha={temSenha} />
        {temSenha ? <TrocarSenha /> : (
          <Cartao>
            <h2 className="flex items-center gap-2 text-lg font-bold text-marca"><KeyRound className="size-5" /> Senha</h2>
            <p className="mt-1 text-sm text-suave">Você entra com a sua conta do Google, então não precisa de senha aqui.</p>
          </Cartao>
        )}
        <Cartao>
          <h2 className="flex items-center gap-2 text-lg font-bold text-marca"><Bell className="size-5" /> Avisos</h2>
          <p className="mt-1 text-sm text-suave">Escolha quais notificações você quer receber na plataforma.</p>
          <Link to="/notificacoes" className="mt-3 inline-block text-sm font-semibold text-destaque hover:underline">Escolher notificações</Link>
        </Cartao>
      </div>
    </>
  );
}

function Dados({ nomeAtual, idPerfil, aoSalvar, papel, email, comGoogle, temSenha }: {
  nomeAtual: string;
  idPerfil: string;
  aoSalvar: () => Promise<void>;
  papel: string;
  email: string;
  comGoogle: boolean;
  temSenha: boolean;
}) {
  const [nome, setNome] = useState(nomeAtual);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState(false);
  const alterado = nome.trim() !== nomeAtual.trim();

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const limpo = nome.trim().replace(/\s+/g, " ");
    setErro("");
    if (limpo.length < 2) return setErro("Escreva o seu nome (pelo menos 2 letras).");
    setSalvando(true);
    const { error } = await supabase.from("perfis").update({ nome: limpo }).eq("id", idPerfil);
    if (error) {
      setSalvando(false);
      return setErro(traduzirErro(error.message));
    }
    await aoSalvar();
    setSalvando(false);
    setNome(limpo);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2500);
  }

  return (
    <Cartao>
      <div className="mb-5 flex items-center gap-4">
        <Avatar tamanho="size-16" texto="text-xl" />
        <div className="min-w-0">
          <p className="truncate font-serif text-xl font-bold text-marca">{nomeAtual || "Sem nome ainda"}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-suave">
            <Etiqueta>{papel}</Etiqueta>
            <span className="inline-flex items-center gap-1"><Mail className="size-3.5" aria-hidden="true" /> <span className="truncate" translate="no">{email}</span></span>
          </p>
        </div>
      </div>

      <form onSubmit={enviar} className="space-y-4">
        {erro && <Aviso>{erro}</Aviso>}
        <Campo
          rotulo="Seu nome"
          name="nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          autoComplete="name"
          maxLength={120}
          placeholder="Maria Souza"
          dica="É o nome que a professora e a turma veem."
          required
        />
        <div className="flex flex-wrap items-center gap-3">
          <Botao type="submit" carregando={salvando} disabled={!alterado}>Salvar nome</Botao>
          {salvo && <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-sucesso" role="status"><CheckCircle2 className="size-4" /> Nome salvo</span>}
        </div>
      </form>

      <p className="mt-5 border-t border-borda pt-4 text-sm text-suave">
        <strong className="text-texto">Como você entra:</strong>{" "}
        {comGoogle && temSenha ? "com a sua conta do Google ou com e-mail e senha." : comGoogle ? "com a sua conta do Google." : "com e-mail e senha."}
        {" "}O e-mail não muda por aqui; se precisar trocar, fale com a escola.
      </p>
    </Cartao>
  );
}

function TrocarSenha() {
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [feito, setFeito] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const dados = new FormData(formulario);
    const nova = String(dados.get("nova"));
    setErro("");
    setFeito(false);
    if (nova !== String(dados.get("confirmacao"))) return setErro("As senhas não são iguais.");
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: nova });
    setSalvando(false);
    if (error) return setErro(traduzirErro(error.message));
    formulario.reset();
    setFeito(true);
  }

  return (
    <Cartao>
      <h2 className="flex items-center gap-2 text-lg font-bold text-marca"><KeyRound className="size-5" /> Trocar senha</h2>
      <form onSubmit={enviar} className="mt-4 space-y-4">
        {erro && <Aviso>{erro}</Aviso>}
        {feito && <Aviso tipo="sucesso">Senha trocada. Use a nova da próxima vez que entrar.</Aviso>}
        <Campo rotulo="Nova senha" name="nova" type="password" autoComplete="new-password" minLength={8} dica="Pelo menos 8 caracteres." required />
        <Campo rotulo="Repita a nova senha" name="confirmacao" type="password" autoComplete="new-password" minLength={8} required />
        <Botao type="submit" carregando={salvando}>Trocar senha</Botao>
      </form>
    </Cartao>
  );
}
