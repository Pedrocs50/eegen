import { Check, Lightbulb, X } from "lucide-react";
import type { ReactNode } from "react";
import { normalizarResposta, partesDoEnunciado, type Gabarito, type Questao, type Resposta } from "../lib/exercicios";
import { LANG_HTML, type Idioma } from "../lib/idiomas";

export type Correcao = { fracao: number; gabarito: Gabarito; explicacao: string };

type Props = {
  numero: number;
  questao: Omit<Questao, "gabarito" | "explicacao">;
  resposta: Resposta | undefined;
  aoResponder: (r: Resposta) => void;
  correcao?: Correcao;
  /** Idioma da lista: o texto do exercício é marcado com esse idioma (leitor de tela) e fica fora da tradução automática. */
  idioma?: Idioma;
};

/**
 * Texto que está na língua estudada. O leitor de tela passa a pronunciá-lo no idioma certo, e o tradutor do navegador
 * não o traduz (o que entregaria a resposta). Sem idioma, vira um span comum.
 */
export function NoIdioma({ idioma, children, className }: { idioma?: Idioma; children: ReactNode; className?: string }) {
  return idioma ? <span lang={LANG_HTML[idioma]} translate="no" className={className}>{children}</span> : <span className={className}>{children}</span>;
}

const ENTRADA =
  "rounded-lg border-b-2 border-borda bg-creme px-2 py-1 text-center font-semibold focus:border-destaque focus:outline-none disabled:opacity-100";

/** Uma questão para o aluno responder; depois do envio, mostra a correção. */
export default function QuestaoAluno({ numero, questao: q, resposta, aoResponder, correcao, idioma }: Props) {
  const corrigida = !!correcao;
  const status = !correcao ? null : correcao.fracao === 1 ? "certa" : correcao.fracao > 0 ? "parcial" : "errada";
  const borda = { certa: "border-sucesso", parcial: "border-[#d39b3a]", errada: "border-erro" }[status ?? "certa"];

  return (
    <article className={`rounded-2xl border bg-superficie p-5 ${corrigida ? `border-l-4 ${borda}` : "border-borda"}`}>
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-marinho-800 text-sm font-bold text-white">{numero}</span>
        <div className="min-w-0 flex-1">
          {q.formato === "multipla_escolha" && <MultiplaEscolha q={q} r={resposta} responder={aoResponder} correcao={correcao} idioma={idioma} />}
          {q.formato === "verdadeiro_falso" && <VerdadeiroFalso q={q} r={resposta} responder={aoResponder} correcao={correcao} idioma={idioma} />}
          {(q.formato === "lacuna" || q.formato === "completar_letras" || q.formato === "lacuna_opcoes") && (
            <Lacunas q={q} r={resposta} responder={aoResponder} correcao={correcao} idioma={idioma} />
          )}
          {q.formato === "resposta_curta" && <RespostaCurta q={q} r={resposta} responder={aoResponder} correcao={correcao} idioma={idioma} />}
        </div>
        {status && (
          <span
            className={`grid size-8 shrink-0 place-items-center rounded-full ${status === "errada" ? "bg-erro-suave text-erro" : "bg-sucesso-suave text-sucesso"}`}
            aria-label={{ certa: "Correta", parcial: "Parcialmente correta", errada: "Incorreta" }[status]}
          >
            {status === "errada" ? <X className="size-4" /> : <Check className="size-4" />}
          </span>
        )}
      </div>

      {correcao?.explicacao && (
        <div className="mt-4 flex gap-2 rounded-xl bg-coral-suave p-3 text-sm">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-coral" aria-hidden="true" />
          <p><span className="font-semibold text-coral">Dica: </span>{correcao.explicacao}</p>
        </div>
      )}
    </article>
  );
}

type PropsParte = { q: Props["questao"]; r: Resposta | undefined; responder: (r: Resposta) => void; correcao?: Correcao; idioma?: Idioma };

function MultiplaEscolha({ q, r, responder, correcao, idioma }: PropsParte) {
  const opcoes = (q.conteudo.opcoes as string[] | undefined) ?? [];
  return (
    <fieldset>
      <legend className="mb-3 font-semibold"><NoIdioma idioma={idioma}>{q.enunciado}</NoIdioma></legend>
      <div className="space-y-2">
        {opcoes.map((opcao, i) => {
          const escolhida = r?.opcao === i;
          const certa = correcao && correcao.gabarito.correta === i;
          const estilo = correcao
            ? certa
              ? "border-sucesso bg-sucesso-suave text-sucesso"
              : escolhida
                ? "border-erro bg-erro-suave text-erro line-through"
                : "border-borda opacity-60"
            : escolhida
              ? "border-destaque bg-destaque-suave text-marca"
              : "border-borda hover:border-destaque";
          return (
            <label key={i} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${estilo}`}>
              <input type="radio" name={q.id} checked={escolhida} disabled={!!correcao} onChange={() => responder({ opcao: i })} className="sr-only" />
              <span className={`grid size-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${escolhida || certa ? "bg-marca text-sobre-marca" : "bg-creme text-suave"}`}>
                {"ABCDE"[i]}
              </span>
              <NoIdioma idioma={idioma}>{opcao}</NoIdioma>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function VerdadeiroFalso({ q, r, responder, correcao, idioma }: PropsParte) {
  return (
    <fieldset>
      <legend className="mb-3 font-semibold"><NoIdioma idioma={idioma}>{q.enunciado}</NoIdioma></legend>
      <div className="flex gap-2">
        {[true, false].map((valor) => {
          const escolhida = r?.valor === valor;
          const certa = correcao && correcao.gabarito.valor === valor;
          const estilo = correcao
            ? certa
              ? "border-sucesso bg-sucesso-suave text-sucesso"
              : escolhida
                ? "border-erro bg-erro-suave text-erro line-through"
                : "border-borda opacity-60"
            : escolhida
              ? "border-destaque bg-destaque-suave text-marca"
              : "border-borda hover:border-destaque";
          return (
            <label key={String(valor)} className={`cursor-pointer rounded-xl border px-5 py-2.5 text-sm font-semibold transition ${estilo}`}>
              <input type="radio" name={q.id} checked={escolhida} disabled={!!correcao} onChange={() => responder({ valor })} className="sr-only" />
              <span lang="en" translate="no">{valor ? "True" : "False"}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Lacunas digitadas, lacunas com opções e completar letras: o enunciado com campos no meio. */
function Lacunas({ q, r, responder, correcao, idioma }: PropsParte) {
  const partes = partesDoEnunciado(q.enunciado);
  const valores = r?.lacunas ?? [];
  const opcoes = (q.conteudo.opcoes as string[][] | undefined) ?? [];
  const letras = q.formato === "completar_letras";
  const banco = (q.conteudo.banco ?? []).map((p) => p.trim()).filter(Boolean);

  function definir(i: number, valor: string | number) {
    const novos = [...valores];
    novos[i] = valor;
    responder({ lacunas: novos });
  }

  function respostaCerta(i: number) {
    const g = correcao?.gabarito.lacunas?.[i];
    if (q.formato === "lacuna_opcoes") return opcoes[i]?.[g as number]?.trim();
    return (g as string[] | undefined)?.map((a) => a.trim()).find(Boolean);
  }

  function lacunaCerta(i: number) {
    const g = correcao?.gabarito;
    if (q.formato === "lacuna_opcoes") return valores[i] === g?.lacunas?.[i];
    const ignorar = !!g?.ignorar_acentos;
    const dada = normalizarResposta(String(valores[i] ?? ""), ignorar);
    return dada !== "" && ((g?.lacunas?.[i] as string[] | undefined) ?? []).some((a) => normalizarResposta(a, ignorar) === dada);
  }

  return (
    <div>
      {banco.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {banco.map((palavra) => <NoIdioma key={palavra} idioma={idioma} className="rounded-full bg-destaque-suave px-2.5 py-1 text-xs font-semibold text-marca">{palavra}</NoIdioma>)}
        </div>
      )}
      <p className={`leading-[2.6] ${letras ? "font-mono text-2xl tracking-wide" : ""}`}>
        {partes.map((texto, i) => (
          <span key={i}>
            <NoIdioma idioma={idioma}>{texto}</NoIdioma>
            {i < partes.length - 1 && (
              <span className="inline-flex flex-col items-center align-middle">
                {q.formato === "lacuna_opcoes" ? (
                  <select
                    value={valores[i] ?? ""}
                    disabled={!!correcao}
                    onChange={(e) => definir(i, Number(e.target.value))}
                    aria-label={`Lacuna ${i + 1}`}
                    className={`${ENTRADA} mx-1 text-base ${correcao ? (lacunaCerta(i) ? "text-sucesso" : "text-erro") : "text-marca"}`}
                  >
                    <option value="" disabled>escolha</option>
                    {(opcoes[i] ?? []).map((opcao, k) => <option key={k} value={k} lang={idioma ? LANG_HTML[idioma] : undefined}>{opcao.trim()}</option>)}
                  </select>
                ) : (
                  <input
                    value={String(valores[i] ?? "")}
                    disabled={!!correcao}
                    onChange={(e) => definir(i, e.target.value)}
                    aria-label={`Lacuna ${i + 1}`}
                    lang={idioma ? LANG_HTML[idioma] : undefined}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className={`${ENTRADA} mx-1 ${letras ? "w-12 text-2xl" : "w-36 text-base"} ${correcao ? (lacunaCerta(i) ? "text-sucesso" : "text-erro line-through") : "text-marca"}`}
                  />
                )}
                {correcao && !lacunaCerta(i) && respostaCerta(i) && (
                  <NoIdioma idioma={idioma} className="text-xs leading-tight font-semibold text-sucesso">{respostaCerta(i)}</NoIdioma>
                )}
              </span>
            )}
          </span>
        ))}
      </p>
    </div>
  );
}

function RespostaCurta({ q, r, responder, correcao, idioma }: PropsParte) {
  const aceita = correcao?.gabarito.aceitas?.map((a) => a.trim()).find(Boolean);
  return (
    <div>
      <label htmlFor={`resposta-${q.id}`} className="mb-3 block font-semibold"><NoIdioma idioma={idioma}>{q.enunciado}</NoIdioma></label>
      <input
        id={`resposta-${q.id}`}
        value={r?.texto ?? ""}
        disabled={!!correcao}
        onChange={(e) => responder({ texto: e.target.value })}
        lang={idioma ? LANG_HTML[idioma] : undefined}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        className="h-12 w-full rounded-xl border border-borda bg-superficie px-3.5 focus:border-destaque focus:outline-none focus:ring-4 focus:ring-destaque-suave disabled:bg-fundo"
      />
      {correcao && correcao.fracao < 1 && aceita && (
        <p className="mt-2 text-sm"><span className="text-suave">Resposta esperada: </span><NoIdioma idioma={idioma} className="font-semibold text-sucesso">{aceita}</NoIdioma></p>
      )}
    </div>
  );
}
