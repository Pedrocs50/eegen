import type { ReactNode } from "react";
import { Check, Plus, Shuffle, X } from "lucide-react";
import {
  FORMATOS,
  HABILIDADES,
  contarLacunas,
  sincronizarLacunas,
  type Habilidade,
  type Questao,
} from "../lib/exercicios";

const CONTROLE =
  "w-full rounded-xl border border-borda bg-superficie px-3 py-2.5 text-sm text-texto placeholder:text-suave/70 focus:border-destaque focus:outline-none focus:ring-4 focus:ring-destaque-suave";

function Rotulo({ children, dica }: { children: ReactNode; dica?: string }) {
  return (
    <span className="mb-1 block text-xs font-semibold text-texto">
      {children}
      {dica && <span className="ml-1 font-normal text-suave">· {dica}</span>}
    </span>
  );
}

type Props = { questao: Questao; aoMudar: (q: Questao) => void };

/** Formulário de uma questão, adaptado ao formato. */
export default function EditorQuestao({ questao: q, aoMudar }: Props) {
  const mudar = (parcial: Partial<Questao>) => aoMudar({ ...q, ...parcial });
  const mudarEnunciado = (enunciado: string) => aoMudar(sincronizarLacunas({ ...q, enunciado }));

  return (
    <div className="space-y-4">
      {q.formato === "completar_letras" ? (
        <label className="block">
          <Rotulo dica="use _ no lugar de cada grupo de letras que falta">Palavra com lacunas</Rotulo>
          <input className={`${CONTROLE} font-mono`} value={q.enunciado} onChange={(e) => mudarEnunciado(e.target.value)} placeholder="Co_bustible" />
        </label>
      ) : (
        <label className="block">
          <Rotulo dica={q.formato === "lacuna" || q.formato === "lacuna_opcoes" ? "use ___ onde fica cada lacuna" : undefined}>
            {q.formato === "verdadeiro_falso" ? "Afirmação" : "Enunciado"}
          </Rotulo>
          <textarea rows={2} className={CONTROLE} value={q.enunciado} onChange={(e) => mudarEnunciado(e.target.value)} />
        </label>
      )}

      {q.formato === "multipla_escolha" && <Alternativas q={q} mudar={mudar} />}
      {q.formato === "verdadeiro_falso" && <VerdadeiroFalso q={q} mudar={mudar} />}
      {(q.formato === "lacuna" || q.formato === "completar_letras") && <RespostasDasLacunas q={q} mudar={mudar} />}
      {q.formato === "lacuna_opcoes" && <OpcoesDasLacunas q={q} mudar={mudar} />}
      {q.formato === "resposta_curta" && <RespostasAceitas q={q} mudar={mudar} />}

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <label className="block">
          <Rotulo dica="aparece na correção, como nos slides de Respostas">Explicação</Rotulo>
          <input className={CONTROLE} value={q.explicacao} onChange={(e) => mudar({ explicacao: e.target.value })} placeholder="Usamos 'into' quando há movimento para dentro." />
        </label>
        <label className="block">
          <Rotulo>Habilidade</Rotulo>
          <select className={CONTROLE} value={q.habilidade} onChange={(e) => mudar({ habilidade: e.target.value as Habilidade })}>
            {Object.entries(HABILIDADES).map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}

type PropsParte = { q: Questao; mudar: (parcial: Partial<Questao>) => void };

function Alternativas({ q, mudar }: PropsParte) {
  const opcoes = (q.conteudo.opcoes as string[] | undefined) ?? [];
  const correta = q.gabarito.correta ?? 0;
  const definir = (novas: string[], novaCorreta = correta) =>
    mudar({ conteudo: { ...q.conteudo, opcoes: novas }, gabarito: { ...q.gabarito, correta: Math.min(novaCorreta, novas.length - 1) } });

  function embaralhar() {
    const certa = opcoes[correta];
    const novas = [...opcoes].sort(() => Math.random() - 0.5);
    definir(novas, novas.indexOf(certa));
  }

  return (
    <div>
      <Rotulo dica="marque a correta">Alternativas</Rotulo>
      <ul className="space-y-2">
        {opcoes.map((opcao, i) => (
          <li key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => definir(opcoes, i)}
              aria-label={`Marcar alternativa ${"ABCDE"[i]} como correta`}
              aria-pressed={i === correta}
              className={`grid size-9 shrink-0 place-items-center rounded-lg text-sm font-bold transition ${
                i === correta ? "bg-sucesso text-white" : "border border-borda text-suave hover:border-sucesso hover:text-sucesso"
              }`}
            >
              {i === correta ? <Check className="size-4" /> : "ABCDE"[i]}
            </button>
            <input className={CONTROLE} value={opcao} onChange={(e) => definir(opcoes.map((o, j) => (j === i ? e.target.value : o)))} placeholder={`Alternativa ${"ABCDE"[i]}`} />
            {opcoes.length > 2 && (
              <button
                type="button"
                onClick={() => definir(opcoes.filter((_, j) => j !== i), i < correta ? correta - 1 : i === correta ? 0 : correta)}
                aria-label={`Remover alternativa ${"ABCDE"[i]}`}
                className="grid size-9 shrink-0 place-items-center rounded-lg text-suave hover:bg-fundo hover:text-erro"
              >
                <X className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        {opcoes.length < 5 && (
          <button type="button" onClick={() => definir([...opcoes, ""])} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-destaque hover:bg-destaque-suave">
            <Plus className="size-3.5" /> Alternativa
          </button>
        )}
        <button type="button" onClick={embaralhar} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-suave hover:bg-fundo">
          <Shuffle className="size-3.5" /> Embaralhar
        </button>
      </div>
    </div>
  );
}

function VerdadeiroFalso({ q, mudar }: PropsParte) {
  return (
    <div>
      <Rotulo>Resposta correta</Rotulo>
      <div className="flex gap-2" role="radiogroup" aria-label="Resposta correta">
        {[true, false].map((valor) => (
          <button
            key={String(valor)}
            type="button"
            role="radio"
            aria-checked={q.gabarito.valor === valor}
            onClick={() => mudar({ gabarito: { valor } })}
            className={`h-10 rounded-xl px-5 text-sm font-semibold transition ${
              q.gabarito.valor === valor ? "bg-sucesso text-white" : "border border-borda text-suave hover:text-texto"
            }`}
          >
            {valor ? "True" : "False"}
          </button>
        ))}
      </div>
    </div>
  );
}

function CaixaAcentos({ q, mudar }: PropsParte) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-suave">
      <input
        type="checkbox"
        checked={!!q.gabarito.ignorar_acentos}
        onChange={(e) => mudar({ gabarito: { ...q.gabarito, ignorar_acentos: e.target.checked } })}
        className="size-4 accent-[var(--c-marca)]"
      />
      Aceitar sem acento (ex.: "esta" vale por "está")
    </label>
  );
}

function RespostasDasLacunas({ q, mudar }: PropsParte) {
  const n = contarLacunas(q.enunciado);
  const lacunas = (q.gabarito.lacunas as string[][] | undefined) ?? [];
  if (n === 0) return <p className="text-xs text-erro">Nenhuma lacuna encontrada: use _ no texto acima.</p>;

  return (
    <div className="space-y-2">
      <Rotulo dica="separe respostas alternativas com |">Respostas de cada lacuna</Rotulo>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-creme text-xs font-bold text-suave">{i + 1}</span>
          <input
            className={CONTROLE}
            value={(lacunas[i] ?? []).join("|")}
            onChange={(e) => mudar({ gabarito: { ...q.gabarito, lacunas: lacunas.map((l, j) => (j === i ? e.target.value.split("|") : l)) } })}
            placeholder="went | did go"
          />
        </div>
      ))}
      {q.formato === "lacuna" && (
        <label className="block pt-2">
          <Rotulo dica="opcional; aparece para o aluno, separado por vírgula">Banco de palavras</Rotulo>
          <input
            className={CONTROLE}
            value={(q.conteudo.banco ?? []).join(",")}
            onChange={(e) => mudar({ conteudo: { ...q.conteudo, banco: e.target.value ? e.target.value.split(",") : [] } })}
            placeholder="into, across, through"
          />
        </label>
      )}
      <CaixaAcentos q={q} mudar={mudar} />
    </div>
  );
}

function OpcoesDasLacunas({ q, mudar }: PropsParte) {
  const n = contarLacunas(q.enunciado);
  const opcoes = (q.conteudo.opcoes as string[][] | undefined) ?? [];
  const corretas = (q.gabarito.lacunas as number[] | undefined) ?? [];
  if (n === 0) return <p className="text-xs text-erro">Nenhuma lacuna encontrada: use ___ no texto acima.</p>;

  return (
    <div className="space-y-2">
      <Rotulo dica="separe as opções com / e escolha a correta">Opções de cada lacuna</Rotulo>
      {Array.from({ length: n }, (_, i) => {
        const daLacuna = opcoes[i] ?? [];
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-creme text-xs font-bold text-suave">{i + 1}</span>
            <input
              className={CONTROLE}
              value={daLacuna.join("/")}
              onChange={(e) => mudar({ conteudo: { ...q.conteudo, opcoes: opcoes.map((o, j) => (j === i ? e.target.value.split("/") : o)) } })}
              placeholder="y/e"
            />
            <select
              className={`${CONTROLE} w-40`}
              value={corretas[i] ?? 0}
              onChange={(e) => mudar({ gabarito: { ...q.gabarito, lacunas: corretas.map((c, j) => (j === i ? Number(e.target.value) : c)) } })}
              aria-label={`Opção correta da lacuna ${i + 1}`}
            >
              {daLacuna.map((opcao, k) => <option key={k} value={k}>Certa: {opcao.trim() || `opção ${k + 1}`}</option>)}
            </select>
          </div>
        );
      })}
    </div>
  );
}

function RespostasAceitas({ q, mudar }: PropsParte) {
  return (
    <div className="space-y-2">
      <label className="block">
        <Rotulo dica="uma por linha; maiúsculas, hífens e pontuação não contam">Respostas aceitas</Rotulo>
        <textarea
          rows={3}
          className={CONTROLE}
          value={(q.gabarito.aceitas ?? []).join("\n")}
          onChange={(e) => mudar({ gabarito: { ...q.gabarito, aceitas: e.target.value.split("\n") } })}
          placeholder={"eight hundred and fifty-one\neight hundred fifty-one"}
        />
      </label>
      <CaixaAcentos q={q} mudar={mudar} />
    </div>
  );
}

export function NomeFormato({ formato }: { formato: Questao["formato"] }) {
  return <>{FORMATOS[formato].nome}</>;
}
