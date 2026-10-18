import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { ProvedorAuth, useAuth } from "./lib/auth";
import type { Papel } from "./lib/supabase";
import Painel from "./componentes/Painel";
import { Aviso, Botao, CartaoAuth, Carregando } from "./componentes/ui";
import Entrar from "./paginas/Entrar";
import Cadastro from "./paginas/Cadastro";
import EsqueciSenha from "./paginas/EsqueciSenha";
import NovaSenha from "./paginas/NovaSenha";
import Admin from "./paginas/Admin";
import { InicioAluno, InicioProfessor } from "./paginas/Inicios";

const PAGINA_INICIAL: Record<Papel, string> = {
  admin: "/admin",
  professor: "/professor",
  aluno: "/aluno",
};

/** Telas de quem ainda não entrou; quem já está logado vai para a sua área. */
function SoDeslogado({ children }: { children: ReactNode }) {
  const { sessao, carregando } = useAuth();
  if (carregando) return <Carregando />;
  return sessao ? <Navigate to="/" replace /> : children;
}

/** Libera a rota para os papéis indicados. O admin acessa todas as áreas. */
function Protegida({ papeis }: { papeis: Papel[] }) {
  const { sessao, perfil, carregando, sair } = useAuth();
  if (carregando) return <Carregando />;
  if (!sessao) return <Navigate to="/entrar" replace />;
  if (!perfil) {
    return (
      <CartaoAuth titulo="Perfil não encontrado">
        <Aviso>Sua conta existe, mas o perfil não foi criado. Avise o administrador da plataforma.</Aviso>
        <Botao variante="secundario" onClick={sair} className="mt-4 w-full">Sair</Botao>
      </CartaoAuth>
    );
  }
  if (perfil.papel !== "admin" && !papeis.includes(perfil.papel)) {
    return <Navigate to={PAGINA_INICIAL[perfil.papel]} replace />;
  }
  return <Painel />;
}

function Inicio() {
  const { sessao, perfil, carregando } = useAuth();
  if (carregando) return <Carregando />;
  if (!sessao) return <Navigate to="/entrar" replace />;
  return <Navigate to={perfil ? PAGINA_INICIAL[perfil.papel] : "/aluno"} replace />;
}

export default function App() {
  return (
    <ProvedorAuth>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/entrar" element={<SoDeslogado><Entrar /></SoDeslogado>} />
          <Route path="/cadastro" element={<SoDeslogado><Cadastro /></SoDeslogado>} />
          <Route path="/esqueci-senha" element={<SoDeslogado><EsqueciSenha /></SoDeslogado>} />
          <Route path="/nova-senha" element={<NovaSenha />} />
          <Route element={<Protegida papeis={["admin"]} />}>
            <Route path="/admin" element={<Admin />} />
          </Route>
          <Route element={<Protegida papeis={["professor"]} />}>
            <Route path="/professor" element={<InicioProfessor />} />
          </Route>
          <Route element={<Protegida papeis={["aluno"]} />}>
            <Route path="/aluno" element={<InicioAluno />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ProvedorAuth>
  );
}
