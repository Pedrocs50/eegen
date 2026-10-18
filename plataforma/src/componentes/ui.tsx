import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { Link } from "react-router";
import { BookOpenCheck, Eye, EyeOff, Headphones, Languages, type LucideIcon } from "lucide-react";

/** Logotipo provisório em texto, até termos o arquivo do logo oficial. */
export function Marca({ claro = false, compacta = false }: { claro?: boolean; compacta?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${claro ? "text-white" : "text-marca"}`}>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#d57877] text-sm font-extrabold tracking-tight text-white">UP</span>
      {!compacta && <span className="text-lg font-extrabold tracking-tight">UP English</span>}
    </span>
  );
}

/** Fileira de bolinhas, o mesmo elemento das capas dos exercícios. */
export function Pontilhado({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`h-3 ${className}`}
      style={{ backgroundImage: "radial-gradient(circle, currentColor 4px, transparent 4.5px)", backgroundSize: "20px 12px" }}
    />
  );
}

type PropsBotao = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "primario" | "secundario" | "fantasma";
  carregando?: boolean;
};

export function Botao({ variante = "primario", carregando, children, className = "", disabled, ...resto }: PropsBotao) {
  const estilos = {
    primario: "bg-marca text-sobre-marca hover:bg-marca-hover",
    secundario: "border border-borda bg-superficie text-texto hover:bg-fundo",
    fantasma: "text-suave hover:bg-fundo hover:text-texto",
  }[variante];
  return (
    <button
      {...resto}
      disabled={disabled || carregando}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destaque disabled:cursor-wait disabled:opacity-70 ${estilos} ${className}`}
    >
      {carregando ? "Aguarde…" : children}
    </button>
  );
}

type PropsCampo = InputHTMLAttributes<HTMLInputElement> & { rotulo: string; dica?: string };

export function Campo({ rotulo, dica, id, type, ...resto }: PropsCampo) {
  const idCampo = id ?? resto.name;
  const [mostrar, setMostrar] = useState(false);
  const senha = type === "password";
  return (
    <div>
      <label htmlFor={idCampo} className="mb-1.5 block text-sm font-semibold text-texto">{rotulo}</label>
      <div className="relative">
        <input
          id={idCampo}
          type={senha && mostrar ? "text" : type}
          {...resto}
          className={`h-12 w-full rounded-xl border border-borda bg-superficie px-3.5 text-texto placeholder:text-suave/70 focus:border-destaque focus:outline-none focus:ring-4 focus:ring-destaque-suave ${senha ? "pr-12" : ""}`}
        />
        {senha && (
          <button
            type="button"
            onClick={() => setMostrar(!mostrar)}
            aria-label={mostrar ? "Esconder senha" : "Mostrar senha"}
            className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-suave hover:text-texto"
          >
            {mostrar ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        )}
      </div>
      {dica && <p className="mt-1.5 text-xs text-suave">{dica}</p>}
    </div>
  );
}

export function Aviso({ tipo = "erro", children }: { tipo?: "erro" | "sucesso" | "info"; children: ReactNode }) {
  const estilos = {
    erro: "border-erro/30 bg-erro-suave text-erro",
    sucesso: "border-sucesso/30 bg-sucesso-suave text-sucesso",
    info: "border-destaque/30 bg-destaque-suave text-marca",
  }[tipo];
  return (
    <div role={tipo === "erro" ? "alert" : "status"} className={`rounded-xl border px-3.5 py-3 text-sm ${estilos}`}>
      {children}
    </div>
  );
}

const DESTAQUES: { icone: LucideIcon; texto: string }[] = [
  { icone: BookOpenCheck, texto: "Exercícios das aulas, com correção na hora" },
  { icone: Headphones, texto: "Listening com sotaques britânico, americano e australiano" },
  { icone: Languages, texto: "Inglês e espanhol com a Teacher Monique" },
];

/** Telas de login, cadastro e senha: marca à esquerda, formulário à direita. */
export function CartaoAuth({ titulo, subtitulo, children, rodape }: { titulo: string; subtitulo?: string; children: ReactNode; rodape?: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative overflow-hidden bg-marinho-800 px-6 py-6 text-white lg:flex lg:flex-col lg:px-14 lg:py-12">
        <Link to="/entrar" aria-label="UP English, página inicial"><Marca claro /></Link>
        <div className="hidden lg:my-auto lg:block lg:max-w-md">
          <span className="inline-block rounded-full border border-white/25 px-3 py-1 text-xs font-semibold tracking-widest text-azul-300">
            INGLÊS · ESPAÑOL
          </span>
          <Pontilhado className="mt-8 text-white/90" />
          <p className="mt-5 font-serif text-4xl leading-tight font-bold">Seu próximo nível em inglês começa aqui.</p>
          <p className="mt-2 font-serif text-2xl text-azul-300 italic">Vamos praticar juntos?</p>
          <Pontilhado className="mt-6 text-white/90" />
          <ul className="mt-10 space-y-4">
            {DESTAQUES.map(({ icone: Icone, texto }) => (
              <li key={texto} className="flex items-center gap-3 text-sm text-white/85">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/10"><Icone className="size-5 text-azul-300" /></span>
                {texto}
              </li>
            ))}
          </ul>
        </div>
        <Link to="/sobre" className="mt-10 hidden text-sm font-semibold text-azul-300 hover:text-white lg:block">
          Conheça a Teacher Monique →
        </Link>
      </aside>

      <main className="flex flex-col items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold text-marca">{titulo}</h1>
          {subtitulo && <p className="mt-2 text-suave">{subtitulo}</p>}
          <div className="mt-8">{children}</div>
          {rodape && <div className="mt-8 border-t border-borda pt-6 text-center text-sm text-suave">{rodape}</div>}
        </div>
      </main>
    </div>
  );
}

export function Carregando() {
  return (
    <div className="grid min-h-dvh place-items-center text-suave" role="status">
      Carregando…
    </div>
  );
}

/** Link discreto usado nos rodapés das telas de acesso. */
export function LinkTexto({ para, children }: { para: string; children: ReactNode }) {
  return <Link to={para} className="font-semibold text-destaque hover:underline">{children}</Link>;
}
