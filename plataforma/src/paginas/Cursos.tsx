import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { BookMarked, Plus } from "lucide-react";
import { supabase, traduzirErro } from "../lib/supabase";
import { IDIOMAS, NIVEIS, nomeNivel, useConsulta, type Curso, type Idioma } from "../lib/dados";
import { CabecalhoPagina } from "../componentes/Painel";
import { Aviso, Botao, Campo, CampoAreaTexto, CampoSelecao, Cartao, Etiqueta, EstadoVazio, TextoCarregando } from "../componentes/ui";

type CursoComAulas = Curso & { aulas: { count: number }[] };

/** Formulário de curso, usado para criar e para editar. */
export function FormularioCurso({ inicial, existentes = [], aoSalvar, aoCancelar }: { inicial?: Curso; existentes?: Pick<Curso, "id" | "titulo" | "idioma">[]; aoSalvar: (id: string) => void; aoCancelar: () => void }) {
  const [idioma, setIdioma] = useState<Idioma>(inicial?.idioma ?? "ingles");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    const curso = {
      titulo: String(dados.get("titulo")).trim(),
      idioma,
      nivel: Number(dados.get("nivel")),
      descricao: String(dados.get("descricao")).trim(),
    };
    setErro("");
    if (existentes.some((c) => c.id !== inicial?.id && c.idioma === curso.idioma && c.titulo.trim().toLowerCase() === curso.titulo.toLowerCase())) {
      setErro(`Já existe um curso chamado "${curso.titulo}" em ${IDIOMAS[curso.idioma]}. Procure na lista ou escolha outro nome.`);
      return;
    }
    setSalvando(true);
    const resposta = inicial
      ? await supabase.from("cursos").update(curso).eq("id", inicial.id).select("id").single()
      : await supabase.from("cursos").insert(curso).select("id").single();
    setSalvando(false);
    if (resposta.error) setErro(traduzirErro(resposta.error.message));
    else aoSalvar(resposta.data.id);
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      {erro && <Aviso>{erro}</Aviso>}
      <Campo rotulo="Nome do curso" name="titulo" defaultValue={inicial?.titulo} placeholder="Inglês para iniciantes" required />
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoSelecao rotulo="Idioma" name="idioma" value={idioma} onChange={(e) => setIdioma(e.target.value as Idioma)}>
          {Object.entries(IDIOMAS).map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}
        </CampoSelecao>
        <CampoSelecao rotulo="Nível" name="nivel" defaultValue={inicial?.nivel ?? 1}>
          {NIVEIS[idioma].map((nome, indice) => <option key={nome} value={indice + 1}>{nome}</option>)}
        </CampoSelecao>
      </div>
      <CampoAreaTexto rotulo="Descrição" name="descricao" defaultValue={inicial?.descricao} placeholder="O que o aluno vai aprender neste curso." />
      <div className="flex flex-wrap gap-2">
        <Botao type="submit" carregando={salvando}>{inicial ? "Salvar alterações" : "Criar curso"}</Botao>
        <Botao type="button" variante="secundario" onClick={aoCancelar}>Cancelar</Botao>
      </div>
    </form>
  );
}

export default function Cursos() {
  const [criando, setCriando] = useState(false);
  const navegar = useNavigate();
  const [filtro, setFiltro] = useState<Idioma | "todos">("todos");
  const { dados: cursos, erro, carregando } = useConsulta<CursoComAulas[]>(() =>
    supabase.from("cursos").select("*, aulas(count)").order("idioma").order("nivel").order("titulo"),
  );

  const visiveis = (cursos ?? []).filter((c) => filtro === "todos" || c.idioma === filtro);
  const botaoNovo = <Botao onClick={() => setCriando(true)}><Plus className="size-4" /> Novo curso</Botao>;

  return (
    <>
      <CabecalhoPagina
        etiqueta="Ensino"
        titulo="Cursos"
        descricao="Cada curso reúne as aulas de um idioma e nível. As turmas estudam um curso."
        acoes={!criando && cursos && cursos.length > 0 ? botaoNovo : undefined}
      />

      {criando && (
        <Cartao className="mb-6">
          <h2 className="mb-4 text-xl font-bold text-marca">Novo curso</h2>
          <FormularioCurso
            existentes={cursos ?? []}
            aoCancelar={() => setCriando(false)}
            aoSalvar={(idNovo) => {
              // Abre o curso criado: ali ela já adiciona as aulas.
              setCriando(false);
              navegar(`/cursos/${idNovo}`);
            }}
          />
        </Cartao>
      )}

      {erro && <Aviso>{erro}</Aviso>}
      {carregando && <TextoCarregando />}

      {cursos && cursos.length === 0 && !criando && (
        <EstadoVazio
          icone={BookMarked}
          titulo="Crie o primeiro curso"
          texto="Por exemplo: Inglês Beginner ou Español Principiante. Depois você adiciona as aulas dentro dele."
          acao={botaoNovo}
        />
      )}

      {cursos && cursos.length > 0 && (
        <>
          <div className="mb-5 flex gap-2" role="group" aria-label="Filtrar por idioma">
            {(["todos", "ingles", "espanhol", "frances"] as const).map((valor) => (
              <button
                key={valor}
                onClick={() => setFiltro(valor)}
                aria-pressed={filtro === valor}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  filtro === valor ? "bg-marca text-sobre-marca" : "border border-borda bg-superficie text-suave hover:text-texto"
                }`}
              >
                {valor === "todos" ? "Todos" : IDIOMAS[valor]}
              </button>
            ))}
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visiveis.map((curso) => (
              <li key={curso.id}>
                <Link
                  to={`/cursos/${curso.id}`}
                  className="flex h-full flex-col rounded-2xl border border-borda bg-superficie p-5 transition hover:border-destaque hover:shadow-sm"
                >
                  <div className="flex flex-wrap gap-2">
                    <Etiqueta>{IDIOMAS[curso.idioma]}</Etiqueta>
                    <Etiqueta tom="creme">{nomeNivel(curso.idioma, curso.nivel)}</Etiqueta>
                  </div>
                  <h2 className="mt-4 text-xl font-bold text-marca">{curso.titulo}</h2>
                  {curso.descricao && <p className="mt-1 line-clamp-2 text-sm text-suave">{curso.descricao}</p>}
                  <p className="mt-auto pt-4 text-sm font-semibold text-destaque">
                    {curso.aulas[0]?.count ?? 0} {curso.aulas[0]?.count === 1 ? "aula" : "aulas"} →
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
