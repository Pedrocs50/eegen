import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../lib/auth";
import { NOMES_PAPEIS, supabase, traduzirErro, type Papel, type Perfil } from "../lib/supabase";
import { Aviso } from "../componentes/ui";
import { CabecalhoPagina } from "../componentes/Painel";
import { Link } from "react-router";
import { Ban, ShieldCheck } from "lucide-react";

const PAPEIS: Papel[] = ["admin", "professor", "aluno"];

export default function Admin() {
  const { perfil: eu } = useAuth();
  const [perfis, setPerfis] = useState<Perfil[] | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Papel | "todos" | "bloqueados">("todos");
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState("");

  useEffect(() => {
    supabase
      .from("perfis")
      .select("*")
      .order("criado_em", { ascending: false })
      .then(({ data, error }) => {
        if (error) setErro(traduzirErro(error.message));
        else setPerfis(data as Perfil[]);
      });
  }, []);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (perfis ?? []).filter(
      (p) =>
        (filtro === "todos" || (filtro === "bloqueados" ? p.bloqueado : p.papel === filtro)) &&
        (!termo || p.nome.toLowerCase().includes(termo) || p.email.toLowerCase().includes(termo)),
    );
  }, [perfis, busca, filtro]);

  const contagem = (papel: Papel) => (perfis ?? []).filter((p) => p.papel === papel).length;

  async function mudarPapel(alvo: Perfil, papel: Papel) {
    const quem = alvo.nome || alvo.email;
    // Admin é o papel com mais poder: virar ou deixar de ser admin pede confirmação.
    if (papel === "admin" && !confirm(`Tornar ${quem} admin? Admins veem todos os usuários, mudam papéis, bloqueiam contas e alteram as configurações.`)) return;
    if (alvo.papel === "admin" && !confirm(`Tirar ${quem} de admin? Essa pessoa perde o acesso à administração.`)) return;
    setErro("");
    setSalvo("");
    const anterior = alvo.papel;
    setPerfis((lista) => lista?.map((p) => (p.id === alvo.id ? { ...p, papel } : p)) ?? null);
    const { error } = await supabase.from("perfis").update({ papel }).eq("id", alvo.id);
    if (error) {
      setPerfis((lista) => lista?.map((p) => (p.id === alvo.id ? { ...p, papel: anterior } : p)) ?? null);
      setErro(traduzirErro(error.message));
    } else {
      setSalvo(`${alvo.nome || alvo.email} agora é ${NOMES_PAPEIS[papel].toLowerCase()}.`);
    }
  }

  async function alternarBloqueio(alvo: Perfil) {
    const quem = alvo.nome || alvo.email;
    const bloquear = !alvo.bloqueado;
    if (bloquear && !confirm(`Bloquear ${quem}? A pessoa continua com a conta, mas não acessa mais nada até ser desbloqueada.`)) return;
    setErro("");
    setSalvo("");
    const { error } = await supabase.from("perfis").update({ bloqueado: bloquear }).eq("id", alvo.id);
    if (error) setErro(traduzirErro(error.message));
    else {
      setPerfis((lista) => lista?.map((p) => (p.id === alvo.id ? { ...p, bloqueado: bloquear } : p)) ?? null);
      setSalvo(bloquear ? `${quem} foi bloqueado(a).` : `${quem} foi desbloqueado(a).`);
    }
  }

  return (
    <div className="space-y-6">
      <CabecalhoPagina etiqueta="Administração" titulo="Usuários" descricao="Promova professores e admins e acompanhe quem acessa a plataforma." />

      <div className="grid grid-cols-3 gap-3">
        {PAPEIS.map((papel) => (
          <div key={papel} className="rounded-2xl border border-borda bg-superficie p-4">
            <div className="text-sm text-suave">{papel === "professor" ? "Professores" : `${NOMES_PAPEIS[papel]}s`}</div>
            <div className="mt-1 font-serif text-3xl font-bold text-marca">{perfis ? contagem(papel) : "–"}</div>
          </div>
        ))}
      </div>

      <Aviso tipo="info">
        Novos cadastros entram como aluno. Para criar um professor, peça que ele se cadastre e mude o papel aqui.
        As IAs e os limites de uso ficam em <Link to="/admin/configuracoes" className="font-semibold underline">Configurações</Link>.
      </Aviso>
      {erro && <Aviso>{erro}</Aviso>}
      {salvo && <Aviso tipo="sucesso">{salvo}</Aviso>}

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou e-mail"
          aria-label="Buscar usuários"
          className="h-11 flex-1 rounded-xl border border-borda bg-superficie px-3.5 placeholder:text-suave/70 focus:border-destaque focus:outline-none focus:ring-4 focus:ring-destaque-suave"
        />
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as Papel | "todos" | "bloqueados")}
          aria-label="Filtrar por papel"
          className="h-11 rounded-xl border border-borda bg-superficie px-3"
        >
          <option value="todos">Todos os papéis</option>
          {PAPEIS.map((papel) => <option key={papel} value={papel}>{NOMES_PAPEIS[papel]}</option>)}
          <option value="bloqueados">Bloqueados</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-borda bg-superficie">
        {perfis === null && !erro && <p className="p-6 text-suave">Carregando usuários…</p>}
        {perfis !== null && visiveis.length === 0 && <p className="p-6 text-suave">Nenhum usuário encontrado.</p>}
        <ul className="divide-y divide-borda">
          {visiveis.map((p) => (
            <li key={p.id} className={`flex flex-col gap-2 p-4 sm:flex-row sm:items-center ${p.bloqueado ? "bg-erro-suave/40" : ""}`}>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{p.nome || "Sem nome"}{p.id === eu?.id && <span className="ml-2 text-xs font-normal text-suave">(você)</span>}
                  {p.bloqueado && <span className="ml-2 rounded-full bg-erro-suave px-2 py-0.5 text-xs font-semibold text-erro">Bloqueado</span>}
                </div>
                <div className="truncate text-sm text-suave">{p.email}</div>
              </div>
              <div className="text-xs text-suave sm:w-28">desde {new Date(p.criado_em).toLocaleDateString("pt-BR")}</div>
              <select
                value={p.papel}
                disabled={p.id === eu?.id}
                onChange={(e) => mudarPapel(p, e.target.value as Papel)}
                aria-label={`Papel de ${p.nome || p.email}`}
                title={p.id === eu?.id ? "Você não pode mudar o próprio papel" : undefined}
                className="h-10 rounded-xl border border-borda bg-superficie px-3 text-sm disabled:opacity-60 sm:w-36"
              >
                {PAPEIS.map((papel) => <option key={papel} value={papel}>{NOMES_PAPEIS[papel]}</option>)}
              </select>
              {p.id !== eu?.id && (
                <button
                  onClick={() => alternarBloqueio(p)}
                  className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold sm:w-36 ${
                    p.bloqueado ? "border border-sucesso/40 text-sucesso hover:bg-sucesso-suave" : "border border-borda text-suave hover:border-erro/40 hover:text-erro"
                  }`}
                >
                  {p.bloqueado ? <><ShieldCheck className="size-4" /> Desbloquear</> : <><Ban className="size-4" /> Bloquear</>}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
