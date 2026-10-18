import { useState } from "react";
import { Check, ChevronDown, ClipboardCopy, ExternalLink, Sparkles, Upload } from "lucide-react";
import { FORMATOS, type Formato, type Lista } from "../lib/exercicios";
import { converterImportacao, lerJsonDoClaude, type ResultadoImportacao } from "../lib/importar";
import { QUANTIDADES_PADRAO, montarPedido } from "../lib/pedidoClaude";
import { Aviso, Botao } from "./ui";

const CONTROLE =
  "w-full rounded-xl border border-borda bg-superficie px-3 py-2.5 text-sm text-texto placeholder:text-suave/70 focus:border-destaque focus:outline-none focus:ring-4 focus:ring-destaque-suave";

type Props = {
  lista: Lista;
  aberto: boolean;
  aoAlternar: () => void;
  aoImportar: (resultado: ResultadoImportacao) => void;
};

/**
 * Gera o pedido para o Claude (claude.ai) e importa o JSON da resposta.
 * Sem custo de API: o professor usa o Claude que já tem e só cola o resultado aqui.
 */
export default function PainelClaude({ lista, aberto, aoAlternar, aoImportar }: Props) {
  const [tema, setTema] = useState(lista.tema);
  const [foco, setFoco] = useState("");
  const [quantidades, setQuantidades] = useState(QUANTIDADES_PADRAO);
  const [leitura, setLeitura] = useState(false);
  const [dica, setDica] = useState(true);
  const [temMaterial, setTemMaterial] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [verPedido, setVerPedido] = useState(false);
  const [colado, setColado] = useState("");
  const [erro, setErro] = useState("");

  const pedido = montarPedido({ idioma: lista.idioma, nivel: lista.nivel, tema: tema || lista.tema, foco, quantidades, leitura, dica, temMaterial });
  const total = Object.values(quantidades).reduce((soma, n) => soma + n, 0);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(pedido);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setVerPedido(true);
      setErro("Não foi possível copiar automaticamente. Abra \"Ver o pedido\" e copie o texto.");
    }
  }

  function importar() {
    setErro("");
    try {
      const resultado = converterImportacao(lerJsonDoClaude(colado));
      if (resultado.totalQuestoes === 0 && resultado.secoes.every((s) => s.tipo_estimulo !== "dica")) {
        throw new Error("O JSON não tem nenhuma questão válida.");
      }
      aoImportar(resultado);
      setColado("");
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <section className="mt-3 overflow-hidden rounded-2xl border border-borda bg-superficie">
      <button onClick={aoAlternar} aria-expanded={aberto} className="flex w-full items-center gap-3 p-4 text-left sm:p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-creme text-suave"><Sparkles className="size-5" /></span>
        <span className="flex-1">
          <span className="block font-serif text-lg font-bold text-marca">Usar outro chat de IA</span>
          <span className="block text-sm text-suave">Copie o pedido para o Claude, ChatGPT ou Gemini e cole a resposta aqui.</span>
        </span>
        <ChevronDown className={`size-5 text-suave transition ${aberto ? "rotate-180" : ""}`} />
      </button>

      {aberto && (
        <div className="space-y-6 border-t border-destaque/30 bg-superficie p-4 sm:p-6">
          {/* Passo 1 */}
          <div>
            <p className="text-[11px] font-bold tracking-[0.14em] text-destaque uppercase">Passo 1 · O pedido</p>
            <p className="mt-1 text-sm text-suave">Idioma e nível vêm do topo da lista. Ajuste o resto:</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold">
                Tema
                <input className={`${CONTROLE} mt-1`} value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Prepositions of movement" />
              </label>
              <label className="block text-xs font-semibold">
                Foco e observações (opcional)
                <input className={`${CONTROLE} mt-1`} value={foco} onChange={(e) => setFoco(e.target.value)} placeholder="Contexto de viagem; evitar 'onto'" />
              </label>
            </div>

            <p className="mt-4 mb-2 text-xs font-semibold">Quantas questões de cada tipo ({total} no total)</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {(Object.keys(FORMATOS) as Formato[]).map((formato) => (
                <label key={formato} className="flex items-center justify-between gap-2 rounded-xl border border-borda px-3 py-2 text-sm">
                  {FORMATOS[formato].nome}
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={quantidades[formato]}
                    onChange={(e) => setQuantidades({ ...quantidades, [formato]: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })}
                    className="w-14 rounded-lg border border-borda bg-superficie px-2 py-1 text-center"
                  />
                </label>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={dica} onChange={(e) => setDica(e.target.checked)} className="size-4 accent-[var(--c-marca)]" /> Começar com uma Dica</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={leitura} onChange={(e) => setLeitura(e.target.checked)} className="size-4 accent-[var(--c-marca)]" /> Incluir texto de leitura</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={temMaterial} onChange={(e) => setTemMaterial(e.target.checked)} className="size-4 accent-[var(--c-marca)]" /> Vou anexar o PDF da aula</label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Botao onClick={copiar}>{copiado ? <><Check className="size-4" /> Pedido copiado</> : <><ClipboardCopy className="size-4" /> Copiar pedido</>}</Botao>
              <a href="https://claude.ai/new" target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-xl border border-borda bg-superficie px-4 text-sm font-semibold hover:bg-fundo">
                <ExternalLink className="size-4" /> Abrir o Claude
              </a>
              <Botao variante="fantasma" onClick={() => setVerPedido(!verPedido)}>{verPedido ? "Esconder o pedido" : "Ver o pedido"}</Botao>
            </div>
            {temMaterial && <p className="mt-2 text-xs text-suave">No Claude, anexe o PDF (clipe ou arrastar) antes de colar o pedido.</p>}
            {verPedido && <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-fundo p-3 text-xs whitespace-pre-wrap">{pedido}</pre>}
          </div>

          {/* Passo 2 */}
          <div>
            <p className="text-[11px] font-bold tracking-[0.14em] text-destaque uppercase">Passo 2 · Cole a resposta</p>
            <p className="mt-1 text-sm text-suave">Copie a resposta inteira do Claude (pode vir com texto em volta) e cole aqui.</p>
            <label htmlFor="json-claude" className="sr-only">Resposta do Claude</label>
            <textarea
              id="json-claude"
              rows={6}
              value={colado}
              onChange={(e) => setColado(e.target.value)}
              placeholder={'```json\n{ "titulo": "...", "secoes": [ ... ] }\n```'}
              className={`${CONTROLE} mt-2 font-mono text-xs`}
            />
            {erro && <div className="mt-2"><Aviso>{erro}</Aviso></div>}
            <Botao onClick={importar} disabled={!colado.trim()} className="mt-3"><Upload className="size-4" /> Importar para a lista</Botao>
            <p className="mt-2 text-xs text-suave">
              {lista.secoes.some((s) => s.questoes.length > 0)
                ? "Como a lista já tem questões, as seções importadas entram no final."
                : "Título, tema e frase de abertura vazios são preenchidos com os da resposta."}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
