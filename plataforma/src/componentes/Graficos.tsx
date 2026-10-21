import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Gráficos leves, feitos com HTML/SVG e as cores do tema (sem biblioteca: a tela abre rápido e
 * acompanha o tema escuro). Cada gráfico tem um resumo em texto para leitores de tela.
 */

export type Tom = "verde" | "azul" | "coral" | "neutro" | "marca";

const COR_BARRA: Record<Tom, string> = {
  verde: "bg-sucesso",
  azul: "bg-destaque",
  coral: "bg-coral",
  neutro: "bg-suave/40",
  marca: "bg-marca",
};
const COR_TEXTO: Record<Tom, string> = {
  verde: "text-sucesso",
  azul: "text-destaque",
  coral: "text-coral",
  neutro: "text-suave",
  marca: "text-marca",
};
const COR_FUNDO_ICONE: Record<Tom, string> = {
  verde: "bg-sucesso-suave text-sucesso",
  azul: "bg-destaque-suave text-marca",
  coral: "bg-coral-suave text-coral",
  neutro: "bg-creme text-suave",
  marca: "bg-destaque-suave text-marca",
};

/** Card de um número importante, com ícone e uma linha de contexto. */
export function Indicador({ icone: Icone, rotulo, valor, detalhe, tom = "marca" }: {
  icone: LucideIcon;
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  tom?: Tom;
}) {
  return (
    <div className="rounded-2xl border border-borda bg-superficie p-4 sm:p-5">
      <div className="flex items-center gap-2.5 sm:gap-3">
        <span className={`hidden size-10 shrink-0 sm:grid place-items-center rounded-xl ${COR_FUNDO_ICONE[tom]}`}><Icone className="size-5" /></span>
        <p className="text-xs font-semibold text-suave sm:text-sm">{rotulo}</p>
      </div>
      <p className={`mt-2 font-serif text-3xl font-bold sm:mt-3 sm:text-4xl ${tom === "marca" || tom === "neutro" ? "text-marca" : COR_TEXTO[tom]}`}>{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-suave sm:text-sm">{detalhe}</p>}
    </div>
  );
}

/** Card com título para cada gráfico ou tabela. */
export function CartaoGrafico({ titulo, descricao, acoes, children, className = "" }: {
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-borda bg-superficie p-5 sm:p-6 ${className}`}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-marca">{titulo}</h2>
          {descricao && <p className="text-sm text-suave">{descricao}</p>}
        </div>
        {acoes}
      </div>
      {children}
    </section>
  );
}

export type Coluna = { rotulo: string; valor: number; dica?: string; tom?: Tom };

/** Gráfico de colunas. Com muitas colunas, só alguns rótulos aparecem embaixo. */
export function Colunas({ dados, altura = 176, sufixo = "", maximo, resumo }: {
  dados: Coluna[];
  altura?: number;
  sufixo?: string;
  maximo?: number;
  resumo: string;
}) {
  const topo = Math.max(maximo ?? 0, ...dados.map((d) => d.valor), 1);
  const cadaRotulo = dados.length > 16 ? Math.ceil(dados.length / 8) : 1;
  return (
    <figure>
      <figcaption className="sr-only">{resumo}</figcaption>
      <div className="flex items-stretch gap-1 sm:gap-1.5" style={{ height: altura }} aria-hidden="true">
        {dados.map((d, i) => (
          <div key={i} className="group relative flex flex-1 flex-col justify-end" title={d.dica ?? `${d.rotulo}: ${d.valor}${sufixo}`}>
            {dados.length <= 12 && d.valor > 0 && (
              <span className="mb-1 text-center text-xs font-semibold text-suave">{d.valor}{sufixo}</span>
            )}
            <div
              className={`min-h-[3px] rounded-t-md transition-[height,opacity] group-hover:opacity-80 ${d.valor > 0 ? COR_BARRA[d.tom ?? "azul"] : "bg-borda"}`}
              style={{ height: `${(d.valor / topo) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1 border-t border-borda pt-2 sm:gap-1.5" aria-hidden="true">
        {dados.map((d, i) => (
          <span key={i} className="flex flex-1 justify-center overflow-visible text-[11px] whitespace-nowrap text-suave">{i % cadaRotulo === 0 ? d.rotulo : ""}</span>
        ))}
      </div>
    </figure>
  );
}

export type Barra = { rotulo: ReactNode; valor: number | null; detalhe?: ReactNode; tom?: Tom };

/** Barras horizontais de 0 a 100 (acerto, notas). */
export function BarrasHorizontais({ dados, resumo, vazio = "Sem dados ainda." }: { dados: Barra[]; resumo: string; vazio?: string }) {
  if (dados.length === 0) return <p className="text-sm text-suave">{vazio}</p>;
  return (
    <figure>
      <figcaption className="sr-only">{resumo}</figcaption>
      <ul className="space-y-3.5">
        {dados.map((d, i) => (
          <li key={i}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-semibold text-texto">{d.rotulo}</span>
              <span className="shrink-0 text-suave">
                {d.detalhe && <span className="mr-2 text-xs">{d.detalhe}</span>}
                <strong className={COR_TEXTO[d.tom ?? "azul"]}>{d.valor === null ? "—" : `${Math.round(d.valor)}%`}</strong>
              </span>
            </div>
            <MedidorBarra valor={d.valor} tom={d.tom} />
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Barrinha de 0 a 100, usada também dentro das tabelas. */
export function MedidorBarra({ valor, tom = "azul", fina = false }: { valor: number | null; tom?: Tom; fina?: boolean }) {
  return (
    <div className={`${fina ? "h-1.5" : "h-2.5"} overflow-hidden rounded-full bg-borda`} aria-hidden="true">
      <div className={`h-full rounded-full ${COR_BARRA[tom]}`} style={{ width: `${Math.max(0, Math.min(100, valor ?? 0))}%` }} />
    </div>
  );
}

export type Ponto = { rotulo: string; valor: number; dica?: string };

/** Linha de 0 a 100 (evolução das notas). Os pontos ficam em intervalos iguais, na ordem. */
export function Linha({ dados, resumo, altura = 200 }: { dados: Ponto[]; resumo: string; altura?: number }) {
  const largura = 600;
  const margem = { esquerda: 36, direita: 12, topo: 12, base: 24 };
  const w = largura - margem.esquerda - margem.direita;
  const h = altura - margem.topo - margem.base;
  const x = (i: number) => margem.esquerda + (dados.length <= 1 ? w / 2 : (i / (dados.length - 1)) * w);
  const y = (v: number) => margem.topo + h - (v / 100) * h;
  const caminho = dados.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.valor).toFixed(1)}`).join(" ");
  const cadaRotulo = Math.max(1, Math.ceil(dados.length / 6));
  return (
    <figure>
      <figcaption className="sr-only">{resumo}</figcaption>
      <svg viewBox={`0 0 ${largura} ${altura}`} className="h-auto w-full" role="img" aria-label={resumo}>
        {[0, 60, 80, 100].map((v) => (
          <g key={v}>
            <line x1={margem.esquerda} x2={largura - margem.direita} y1={y(v)} y2={y(v)} className="stroke-borda" strokeDasharray={v === 0 ? undefined : "4 4"} />
            <text x={margem.esquerda - 8} y={y(v) + 4} textAnchor="end" className="fill-suave text-[11px]">{v}</text>
          </g>
        ))}
        {dados.length > 1 && <path d={caminho} fill="none" className="stroke-destaque" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
        {dados.map((d, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(d.valor)} r={5} className={d.valor >= 80 ? "fill-sucesso" : d.valor >= 60 ? "fill-destaque" : "fill-coral"}>
              <title>{d.dica ?? `${d.rotulo}: ${d.valor}%`}</title>
            </circle>
            {i % cadaRotulo === 0 && (
              <text x={x(i)} y={altura - 6} textAnchor="middle" className="fill-suave text-[11px]">{d.rotulo}</text>
            )}
          </g>
        ))}
      </svg>
    </figure>
  );
}

/** Anel de porcentagem, para destacar uma taxa (ex.: média da lista). */
export function Anel({ valor, tom = "azul", rotulo }: { valor: number | null; tom?: Tom; rotulo: string }) {
  const raio = 42;
  const volta = 2 * Math.PI * raio;
  const cor = { verde: "stroke-sucesso", azul: "stroke-destaque", coral: "stroke-coral", neutro: "stroke-suave", marca: "stroke-marca" }[tom];
  return (
    <svg viewBox="0 0 100 100" className="size-28 shrink-0 -rotate-90" role="img" aria-label={`${rotulo}: ${valor === null ? "sem dados" : `${Math.round(valor)}%`}`}>
      <circle cx="50" cy="50" r={raio} fill="none" className="stroke-borda" strokeWidth="10" />
      <circle
        cx="50" cy="50" r={raio} fill="none" className={cor} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={volta} strokeDashoffset={volta * (1 - Math.max(0, Math.min(100, valor ?? 0)) / 100)}
      />
      <text x="50" y="50" className="rotate-90 fill-marca font-serif text-[22px] font-bold" textAnchor="middle" dominantBaseline="central" style={{ transformOrigin: "50px 50px" }}>
        {valor === null ? "—" : `${Math.round(valor)}%`}
      </text>
    </svg>
  );
}
