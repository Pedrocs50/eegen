import { NavLink, Outlet } from "react-router";
import { useAuth } from "../lib/auth";
import { NOMES_PAPEIS, type Papel } from "../lib/supabase";
import { Marca } from "./ui";

const LINKS: Record<Papel, { para: string; rotulo: string }[]> = {
  admin: [
    { para: "/admin", rotulo: "Usuários" },
    { para: "/professor", rotulo: "Área do professor" },
    { para: "/aluno", rotulo: "Visão do aluno" },
  ],
  professor: [{ para: "/professor", rotulo: "Início" }],
  aluno: [{ para: "/aluno", rotulo: "Meus cursos" }],
};

/** Moldura das áreas logadas: barra superior com navegação e conta. */
export default function Painel() {
  const { perfil, sair } = useAuth();
  if (!perfil) return null;

  return (
    <div className="min-h-dvh">
      <header className="bg-marinho-800 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Marca claro />
          <nav className="order-last flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto" aria-label="Principal">
            {LINKS[perfil.papel].map((link) => (
              <NavLink
                key={link.para}
                to={link.para}
                end
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold ${isActive ? "bg-white/15 text-white" : "text-marinho-100 hover:bg-white/10"}`
                }
              >
                {link.rotulo}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-right leading-tight sm:block">
              <span className="block font-semibold">{perfil.nome || perfil.email}</span>
              <span className="block text-xs text-marinho-100">{NOMES_PAPEIS[perfil.papel]}</span>
            </span>
            <button onClick={sair} className="rounded-lg border border-white/30 px-3 py-1.5 font-semibold hover:bg-white/10">
              Sair
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
