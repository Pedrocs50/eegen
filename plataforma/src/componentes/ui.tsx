import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Marca({ claro = false }: { claro?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${claro ? "text-white" : "text-marinho-800"}`}>
      <span className="grid size-8 place-items-center rounded-lg bg-coral-500 text-sm text-white">UP</span>
      <span className="text-lg">UP English</span>
    </span>
  );
}

type PropsBotao = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "primario" | "secundario";
  carregando?: boolean;
};

export function Botao({ variante = "primario", carregando, children, className = "", disabled, ...resto }: PropsBotao) {
  const estilos =
    variante === "primario"
      ? "bg-marinho-800 text-white hover:bg-marinho-700"
      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50";
  return (
    <button
      {...resto}
      disabled={disabled || carregando}
      className={`inline-flex h-11 items-center justify-center rounded-lg px-4 font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marinho-600 disabled:cursor-wait disabled:opacity-70 ${estilos} ${className}`}
    >
      {carregando ? "Aguarde…" : children}
    </button>
  );
}

type PropsCampo = InputHTMLAttributes<HTMLInputElement> & { rotulo: string; dica?: string };

export function Campo({ rotulo, dica, id, ...resto }: PropsCampo) {
  const idCampo = id ?? resto.name;
  return (
    <label htmlFor={idCampo} className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{rotulo}</span>
      <input
        id={idCampo}
        {...resto}
        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 placeholder:text-slate-400 focus:border-marinho-600 focus:outline-none focus:ring-2 focus:ring-marinho-100"
      />
      {dica && <span className="mt-1 block text-xs text-slate-500">{dica}</span>}
    </label>
  );
}

export function Aviso({ tipo = "erro", children }: { tipo?: "erro" | "sucesso" | "info"; children: ReactNode }) {
  const estilos = {
    erro: "border-red-200 bg-red-50 text-red-800",
    sucesso: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-marinho-100 bg-marinho-50 text-marinho-800",
  }[tipo];
  return (
    <div role={tipo === "erro" ? "alert" : "status"} className={`rounded-lg border px-3 py-2.5 text-sm ${estilos}`}>
      {children}
    </div>
  );
}

/** Moldura das telas de login, cadastro e senha. */
export function CartaoAuth({ titulo, subtitulo, children, rodape }: { titulo: string; subtitulo?: string; children: ReactNode; rodape?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-marinho-800 px-4 py-10">
      <div className="mb-6"><Marca claro /></div>
      <main className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <h1 className="text-2xl font-extrabold text-marinho-900">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-slate-600">{subtitulo}</p>}
        <div className="mt-6">{children}</div>
      </main>
      {rodape && <div className="mt-6 text-sm text-marinho-100">{rodape}</div>}
    </div>
  );
}

export function Carregando() {
  return (
    <div className="grid min-h-dvh place-items-center text-slate-500" role="status">
      Carregando…
    </div>
  );
}
