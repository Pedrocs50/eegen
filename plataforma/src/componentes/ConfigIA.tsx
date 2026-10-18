import { useEffect, useState, type FormEvent } from "react";
import { Sparkles } from "lucide-react";
import { supabase, traduzirErro } from "../lib/supabase";
import { Aviso, Botao, Campo, CampoSelecao, Cartao } from "./ui";

type Config = { provedor: "gemini" | "groq"; modelo: string; limite_diario: number };

type Habilidade = "gerar_lista" | "gerar_audio";

const TEXTOS: Record<Habilidade, { titulo: string; descricao: string; padrao: Config; modelos: Record<Config["provedor"], string[]> }> = {
  gerar_lista: {
    titulo: "Assistente de IA (listas)",
    descricao: "Qual IA gera as listas e quantos pedidos cada professor pode fazer por dia.",
    padrao: { provedor: "gemini", modelo: "gemini-flash-latest", limite_diario: 30 },
    modelos: { gemini: ["gemini-flash-latest", "gemini-3.8-flash", "gemini-3.5-flash-lite"], groq: ["openai/gpt-oss-120b", "openai/gpt-oss-20b"] },
  },
  gerar_audio: {
    titulo: "Voz dos listenings",
    descricao: "Modelo de voz do Gemini e quantos áudios cada professor gera por dia. O plano grátis do Google libera cerca de 10 por dia por modelo (com o reserva, ~20 para a escola).",
    padrao: { provedor: "gemini", modelo: "gemini-3.8-flash-tts", limite_diario: 10 },
    modelos: { gemini: ["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts"], groq: [] },
  },
};

/** Admin escolhe qual IA o Assistente UP usa e quantos pedidos cada professor pode fazer por dia. */
export default function ConfigIA({ habilidade = "gerar_lista" }: { habilidade?: Habilidade }) {
  const textos = TEXTOS[habilidade];
  const [config, setConfig] = useState<Config | null>(null);
  const [usoHoje, setUsoHoje] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    supabase.from("config_ia").select("provedor, modelo, limite_diario").eq("habilidade", habilidade).maybeSingle().then(({ data, error }) => {
      if (error) setErro(traduzirErro(error.message));
      else setConfig((data as Config | null) ?? textos.padrao);
    });
    const inicioDoDia = new Date();
    inicioDoDia.setHours(0, 0, 0, 0);
    supabase.from("geracoes_ia").select("id", { count: "exact", head: true }).eq("habilidade", habilidade).eq("ok", true).gte("criado_em", inicioDoDia.toISOString()).then(({ count }) => setUsoHoje(count ?? 0));
  }, [habilidade, textos.padrao]);

  if (!config) return erro ? <Aviso>{erro}</Aviso> : null;

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setErro("");
    setSalvo(false);
    setSalvando(true);
    const { error } = await supabase.from("config_ia").update(config!).eq("habilidade", habilidade);
    setSalvando(false);
    if (error) setErro(traduzirErro(error.message));
    else setSalvo(true);
  }

  return (
    <Cartao>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-destaque-suave text-marca"><Sparkles className="size-5" /></span>
        <div>
          <h2 className="text-xl font-bold text-marca">{textos.titulo}</h2>
          <p className="text-sm text-suave">
            {textos.descricao}
            {usoHoje !== null && ` Hoje: ${usoHoje} ${usoHoje === 1 ? "pedido" : "pedidos"} no total.`}
          </p>
        </div>
      </div>
      <form onSubmit={salvar} className="mt-5 grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)_9rem_auto] sm:items-end">
        <CampoSelecao
          rotulo="Provedor"
          name="provedor"
          value={config.provedor}
          onChange={(e) => {
            const provedor = e.target.value as Config["provedor"];
            setConfig({ ...config, provedor, modelo: textos.modelos[provedor][0] ?? "" });
          }}
        >
          <option value="gemini">Gemini (Google)</option>
          {habilidade === "gerar_lista" && <option value="groq">Groq</option>}
        </CampoSelecao>
        <div>
          <Campo rotulo="Modelo" name="modelo" list={`modelos-${habilidade}`} value={config.modelo} onChange={(e) => setConfig({ ...config, modelo: e.target.value.trim() })} required />
          <datalist id={`modelos-${habilidade}`}>{textos.modelos[config.provedor].map((m) => <option key={m} value={m} />)}</datalist>
        </div>
        <Campo rotulo="Limite por dia" name="limite" type="number" min={0} max={500} value={config.limite_diario} onChange={(e) => setConfig({ ...config, limite_diario: Number(e.target.value) || 0 })} />
        <Botao type="submit" carregando={salvando}>Salvar</Botao>
      </form>
      {erro && <div className="mt-3"><Aviso>{erro}</Aviso></div>}
      {salvo && <div className="mt-3"><Aviso tipo="sucesso">Configuração salva. Vale a partir do próximo pedido.</Aviso></div>}
      {config.provedor === "groq" && (
        <p className="mt-3 text-xs text-suave">O Groq precisa do segredo GROQ_API_KEY cadastrado nas Edge Functions do Supabase.</p>
      )}
    </Cartao>
  );
}
