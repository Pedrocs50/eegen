import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../lib/auth";
import { NOMES_PAPEIS, supabase, traduzirErro, type Papel, type Perfil } from "../lib/supabase";
import { Aviso } from "../componentes/ui";
import { CabecalhoPagina } from "../componentes/Painel";

const PAPEIS: Papel[] = ["admin", "professor", "aluno"];

export default function Admin() {
  const { perfil: eu } = useAuth();
  const [perfis, setPerfis] = useState<Perfil[] | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Papel | "todos">("todos");
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
        (filtro === "todos" || p.papel === filtro) &&
        (!termo || p.nome.toLowerCase().includes(termo) || p.email.toLowerCase().includes(termo)),
    );
  }, [perfis, busca, filtro]);

  const contagem = (papel: Papel) => (perfis ?? []).filter((p) => p.papel === papel).length;

  async function mudarPapel(alvo: Perfil, papel: Papel) {
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
          onChange={(e) => setFiltro(e.target.value as Papel | "todos")}
          aria-label="Filtrar por papel"
          className="h-11 rounded-xl border border-borda bg-superficie px-3"
        >
          <option value="todos">Todos os papéis</option>
          {PAPEIS.map((papel) => <option key={papel} value={papel}>{NOMES_PAPEIS[papel]}</option>)}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-borda bg-superficie">
        {perfis === null && !erro && <p className="p-6 text-suave">Carregando usuários…</p>}
        {perfis !== null && visiveis.length === 0 && <p className="p-6 text-suave">Nenhum usuário encontrado.</p>}
        <ul className="divide-y divide-borda">
          {visiveis.map((p) => (
            <li key={p.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{p.nome || "Sem nome"}{p.id === eu?.id && <span className="ml-2 text-xs font-normal text-suave">(você)</span>}</div>
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
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
