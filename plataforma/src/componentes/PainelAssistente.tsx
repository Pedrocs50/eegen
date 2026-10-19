import { useEffect, useRef, useState, type FormEvent } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Bot, ChevronDown, ListPlus, RefreshCw, Replace, Send, Sparkles } from "lucide-react";
import { supabase } from "../lib/supabase";
import { FORMATOS, type Formato, type Lista } from "../lib/exercicios";
import { converterImportacao, type ResultadoImportacao } from "../lib/importar";
import { sortearSugestoes } from "../lib/sugestoes";
import { Aviso, Botao } from "./ui";

type ItemConversa =
  | { papel: "professor"; texto: string }
  | { papel: "assistente"; texto: string; lista: Record<string, unknown> | null; resultado: ResultadoImportacao | null };

type RespostaFuncao = { mensagem: string; lista: Record<string, unknown> | null; restantes?: number; erro?: string };


type Props = {
  lista: Lista;
  aberto: boolean;
  aoAlternar: () => void;
  aoUsar: (resultado: ResultadoImportacao, modo: "substituir" | "adicionar") => void;
};

function resumoDosFormatos(resultado: ResultadoImportacao) {
  const contagem = new Map<Formato, number>();
  for (const secao of resultado.secoes) for (const q of secao.questoes) contagem.set(q.formato, (contagem.get(q.formato) ?? 0) + 1);
  return [...contagem].map(([formato, n]) => `${n} ${FORMATOS[formato].nome.toLowerCase()}`).join(" · ");
}

/** Lê a mensagem de erro que a Edge Function devolveu (ela vem no corpo da resposta). */
async function mensagemDeErro(erro: unknown): Promise<string> {
  if (erro instanceof FunctionsHttpError) {
    const corpo = await erro.context.json().catch(() => null);
    // O detalhe técnico vai junto para o professor poder mandar o print quando algo falhar.
    if (corpo?.erro) return corpo.detalhe && corpo.detalhe !== corpo.erro ? `${corpo.erro} (Detalhe: ${String(corpo.detalhe).slice(0, 400)})` : corpo.erro;
  }
  return "Não foi possível falar com o assistente. Verifique sua conexão e tente de novo.";
}

/** Chat com a IA da plataforma: o professor pede, o assistente devolve a lista pronta para entrar no editor. */
export default function PainelAssistente({ lista, aberto, aoAlternar, aoUsar }: Props) {
  const [conversa, setConversa] = useState<ItemConversa[]>([]);
  const [entrada, setEntrada] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [restantes, setRestantes] = useState<number | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  // Novas ideias a cada abertura e quando o idioma ou o nível mudam.
  const [sugestoes, setSugestoes] = useState(() => sortearSugestoes(lista.idioma, lista.nivel));
  useEffect(() => {
    setSugestoes(sortearSugestoes(lista.idioma, lista.nivel));
  }, [lista.idioma, lista.nivel]);
  const listaVazia = !lista.secoes.some((s) => s.questoes.length > 0 || s.estimulo.texto);

  // Chaves de propósito: scrollIntoView devolve uma Promise nos navegadores novos, e o React não aceita isso como retorno.
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [conversa, enviando]);

  async function enviar(texto: string) {
    const pedido = texto.trim();
    if (!pedido || enviando) return;
    const nova: ItemConversa[] = [...conversa, { papel: "professor", texto: pedido }];
    setConversa(nova);
    setEntrada("");
    setErro("");
    setEnviando(true);

    // As respostas anteriores voltam como JSON, para o assistente conseguir alterar a lista que já fez.
    const mensagens = nova.map((item) =>
      item.papel === "professor" ? item : { papel: "assistente", texto: JSON.stringify({ mensagem: item.texto, lista: item.lista }) },
    );
    const { data, error } = await supabase.functions.invoke<RespostaFuncao>("assistente", {
      body: { idioma: lista.idioma, nivel: lista.nivel, mensagens },
    });
    setEnviando(false);
    if (error || !data) {
      setErro(await mensagemDeErro(error));
      return;
    }
    let resultado: ResultadoImportacao | null = null;
    if (data.lista) {
      try {
        resultado = converterImportacao(data.lista);
      } catch (e) {
        setErro(`A lista veio num formato inesperado: ${(e as Error).message} Peça de novo.`);
      }
    }
    if (typeof data.restantes === "number") setRestantes(data.restantes);
    setConversa([...nova, { papel: "assistente", texto: data.mensagem, lista: data.lista, resultado }]);
  }

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    enviar(entrada);
  }

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-marca/30 bg-superficie">
      <button onClick={aoAlternar} aria-expanded={aberto} className="flex w-full items-center gap-3 bg-destaque-suave p-4 text-left sm:p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-marca text-sobre-marca"><Sparkles className="size-5" /></span>
        <span className="flex-1">
          <span className="block font-serif text-lg font-bold text-marca">Assistente UP</span>
          <span className="block text-sm text-suave">Peça os exercícios em uma frase. A lista volta pronta, no padrão da escola, para você revisar.</span>
        </span>
        <ChevronDown className={`size-5 text-suave transition ${aberto ? "rotate-180" : ""}`} />
      </button>

      {aberto && (
        <div className="border-t border-borda">
          <div className="max-h-[28rem] space-y-4 overflow-y-auto p-4 sm:p-5" aria-live="polite">
            {conversa.length === 0 && (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-suave">O assistente usa o idioma e o nível do topo da lista. Algumas ideias:</p>
                  <button
                    onClick={() => setSugestoes(sortearSugestoes(lista.idioma, lista.nivel))}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-destaque hover:bg-destaque-suave"
                  >
                    <RefreshCw className="size-3.5" /> Outras ideias
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {sugestoes.map((s) => (
                    <button key={s} onClick={() => enviar(s)} className="rounded-full border border-borda px-3 py-1.5 text-left text-xs font-semibold text-texto hover:border-destaque hover:text-destaque">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {conversa.map((item, i) =>
              item.papel === "professor" ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-marca px-4 py-2.5 text-sm text-sobre-marca">{item.texto}</p>
                </div>
              ) : (
                <div key={i} className="flex gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-destaque-suave text-marca"><Bot className="size-4" /></span>
                  <div className="max-w-[85%] space-y-2">
                    <p className="rounded-2xl rounded-tl-md bg-fundo px-4 py-2.5 text-sm">{item.texto}</p>
                    {item.resultado && (
                      <div className="rounded-xl border border-borda p-3">
                        <p className="font-serif font-bold text-marca">{item.resultado.dados.titulo || "Lista sem título"}</p>
                        <p className="mt-0.5 text-xs text-suave">
                          {item.resultado.totalQuestoes} questões em {item.resultado.secoes.length} seções · {resumoDosFormatos(item.resultado)}
                        </p>
                        {item.resultado.avisos.length > 0 && <p className="mt-1 text-xs text-coral">{item.resultado.avisos.join(" ")}</p>}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {listaVazia ? (
                            <Botao className="h-9" onClick={() => aoUsar(item.resultado!, "substituir")}><ListPlus className="size-4" /> Usar esta lista</Botao>
                          ) : (
                            <>
                              <Botao className="h-9" onClick={() => aoUsar(item.resultado!, "adicionar")}><ListPlus className="size-4" /> Adicionar ao final</Botao>
                              <Botao variante="secundario" className="h-9" onClick={() => confirm("Substituir todas as seções atuais por esta lista?") && aoUsar(item.resultado!, "substituir")}>
                                <Replace className="size-4" /> Substituir tudo
                              </Botao>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}

            {enviando && (
              <div className="flex gap-2.5" role="status">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-destaque-suave text-marca"><Bot className="size-4 animate-pulse" /></span>
                <p className="rounded-2xl rounded-tl-md bg-fundo px-4 py-2.5 text-sm text-suave">Criando a lista… costuma levar de 15 a 40 segundos.</p>
              </div>
            )}
            <div ref={fim} />
          </div>

          {erro && <div className="px-4 pb-3 sm:px-5"><Aviso>{erro}</Aviso></div>}

          <form onSubmit={aoEnviar} className="flex items-end gap-2 border-t border-borda p-3 sm:p-4">
            <label htmlFor="pedido-assistente" className="sr-only">Pedido para o assistente</label>
            <textarea
              id="pedido-assistente"
              maxLength={1500}
              rows={2}
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar(entrada);
                }
              }}
              placeholder={conversa.length ? "Peça um ajuste: \"deixe as lacunas mais difíceis\"" : "Ex.: 10 questões de simple past sobre entrevista de emprego"}
              className="min-h-11 flex-1 resize-none rounded-xl border border-borda bg-superficie px-3.5 py-2.5 text-sm placeholder:text-suave/70 focus:border-destaque focus:outline-none focus:ring-4 focus:ring-destaque-suave"
            />
            <Botao type="submit" carregando={enviando} disabled={!entrada.trim()} aria-label="Enviar pedido"><Send className="size-4" /></Botao>
          </form>
          {restantes !== null && <p className="px-4 pb-3 text-xs text-suave sm:px-5">Você ainda pode fazer {restantes} pedidos hoje.</p>}
        </div>
      )}
    </section>
  );
}
