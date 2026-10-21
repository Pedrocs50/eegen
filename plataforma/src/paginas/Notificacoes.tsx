import { useState } from "react";
import { useNavigate } from "react-router";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase, traduzirErro } from "../lib/supabase";
import { useConsulta } from "../lib/dados";
import { iconeDoTipo, recontar, tiposDoPapel, type Notificacao } from "../lib/notificacoes";
import { quandoFoi } from "../lib/resultados";
import { CabecalhoPagina } from "../componentes/Painel";
import { Pilula } from "../componentes/TurmaAluno";
import { Aviso, Botao, EstadoVazio, TextoCarregando } from "../componentes/ui";

/** Notificações da pessoa logada e a escolha de quais receber. */
export default function Notificacoes() {
  const { perfil, recarregarPerfil } = useAuth();
  const navegar = useNavigate();
  const [filtro, setFiltro] = useState<"nao_lidas" | "todas">("nao_lidas");
  const [erroAcao, setErroAcao] = useState("");
  const { dados, erro, carregando, recarregar, setDados } = useConsulta<Notificacao[]>(
    () => supabase.from("notificacoes").select("*").order("criada_em", { ascending: false }).limit(100),
  );
  const todas = dados ?? [];
  const naoLidas = todas.filter((n) => !n.lida_em);
  const visiveis = filtro === "nao_lidas" ? naoLidas : todas;
  const tipos = perfil ? tiposDoPapel(perfil.papel) : {};
  const preferencias = (perfil?.preferencias_notificacao ?? {}) as Record<string, boolean>;

  async function abrir(n: Notificacao) {
    if (!n.lida_em) {
      await supabase.from("notificacoes").update({ lida_em: new Date().toISOString() }).eq("id", n.id);
      recontar();
    }
    if (n.link) navegar(n.link);
    else recarregar();
  }

  async function marcarTodas() {
    setErroAcao("");
    const agora = new Date().toISOString();
    setDados(todas.map((n) => ({ ...n, lida_em: n.lida_em ?? agora })));
    const { error } = await supabase.from("notificacoes").update({ lida_em: agora }).is("lida_em", null);
    if (error) setErroAcao(traduzirErro(error.message));
    recontar();
  }

  async function limparLidas() {
    if (!confirm("Apagar as notificações já lidas?")) return;
    const { error } = await supabase.from("notificacoes").delete().not("lida_em", "is", null);
    if (error) setErroAcao(traduzirErro(error.message));
    recarregar();
  }

  async function alternarTipo(tipo: string, ligado: boolean) {
    if (!perfil) return;
    setErroAcao("");
    const { error } = await supabase.from("perfis").update({ preferencias_notificacao: { ...preferencias, [tipo]: ligado } }).eq("id", perfil.id);
    if (error) setErroAcao(traduzirErro(error.message));
    await recarregarPerfil();
  }

  return (
    <>
      <CabecalhoPagina
        etiqueta="Avisos"
        titulo="Notificações"
        descricao="O que aconteceu nas suas turmas. Clique numa notificação para ir direto ao assunto."
        acoes={
          naoLidas.length > 0 ? (
            <Botao variante="secundario" onClick={marcarTodas}><CheckCheck className="size-4" /> Marcar todas como lidas</Botao>
          ) : undefined
        }
      />
      {(erro || erroAcao) && <div className="mb-4"><Aviso>{erro || erroAcao}</Aviso></div>}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Pilula ativa={filtro === "nao_lidas"} onClick={() => setFiltro("nao_lidas")}>Não lidas ({naoLidas.length})</Pilula>
            <Pilula ativa={filtro === "todas"} onClick={() => setFiltro("todas")}>Todas</Pilula>
            {todas.length > naoLidas.length && (
              <button onClick={limparLidas} className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-suave hover:text-erro">
                <Trash2 className="size-4" /> Limpar lidas
              </button>
            )}
          </div>
          {carregando && !dados ? (
            <TextoCarregando />
          ) : visiveis.length === 0 ? (
            <EstadoVazio
              icone={Bell}
              titulo={filtro === "nao_lidas" ? "Tudo em dia" : "Nenhuma notificação ainda"}
              texto={filtro === "nao_lidas" ? "Você não tem notificações novas." : "Quando algo acontecer nas suas turmas, aparece aqui."}
            />
          ) : (
            <ul className="space-y-2">
              {visiveis.map((n) => {
                const Icone = iconeDoTipo(n.tipo);
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => abrir(n)}
                      className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition hover:border-destaque hover:shadow-sm ${
                        n.lida_em ? "border-borda bg-superficie" : "border-destaque/50 bg-destaque-suave"
                      }`}
                    >
                      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${n.tipo === "nota_baixa" ? "bg-coral-suave text-coral" : "bg-superficie text-marca"}`}>
                        <Icone className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-3">
                          <span className={`text-sm ${n.lida_em ? "font-semibold text-texto" : "font-bold text-marca"}`}>{n.titulo}</span>
                          <span className="shrink-0 text-xs text-suave">{quandoFoi(n.criada_em)}</span>
                        </span>
                        {n.texto && <span className="mt-0.5 block text-sm text-suave">{n.texto}</span>}
                      </span>
                      {!n.lida_em && <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-coral" aria-label="Não lida" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="h-fit rounded-2xl border border-borda bg-superficie p-5 sm:p-6">
          <h2 className="text-lg font-bold text-marca">O que você quer receber</h2>
          <p className="mb-4 text-sm text-suave">Vale para as notificações aqui da plataforma.</p>
          <ul className="space-y-4">
            {Object.entries(tipos).map(([tipo, info]) => {
              const ligado = preferencias[tipo] ?? info.padrao;
              const Icone = info.icone;
              return (
                <li key={tipo} className="flex items-start gap-3">
                  <Icone className="mt-0.5 size-5 shrink-0 text-suave" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{info.rotulo}</span>
                    <span className="block text-xs text-suave">{info.descricao}</span>
                  </span>
                  <button
                    role="switch"
                    aria-checked={ligado}
                    aria-label={info.rotulo}
                    onClick={() => alternarTipo(tipo, !ligado)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${ligado ? "bg-sucesso" : "bg-borda"}`}
                  >
                    <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left] ${ligado ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </>
  );
}
