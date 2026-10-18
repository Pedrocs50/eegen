import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, ExternalLink, NotebookPen, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase, traduzirErro } from "../lib/supabase";
import { IDIOMAS, nomeNivel, useConsulta, type Aula, type Curso as TipoCurso } from "../lib/dados";
import { CabecalhoPagina } from "../componentes/Painel";
import { Aviso, Botao, Campo, Cartao, Etiqueta, EstadoVazio, TextoCarregando } from "../componentes/ui";
import { FormularioCurso } from "./Cursos";

type CursoComAulas = TipoCurso & { aulas: Aula[] };

function FormularioAula({ cursoId, inicial, proximoNumero, aoSalvar, aoCancelar }: {
  cursoId: string;
  inicial?: Aula;
  proximoNumero: number;
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    const aula = {
      numero: Number(dados.get("numero")),
      titulo: String(dados.get("titulo")).trim(),
      subtitulo: String(dados.get("subtitulo")).trim(),
      material_url: String(dados.get("material_url")).trim(),
    };
    setErro("");
    setSalvando(true);
    const { error } = inicial
      ? await supabase.from("aulas").update(aula).eq("id", inicial.id)
      : await supabase.from("aulas").insert({ ...aula, curso_id: cursoId });
    setSalvando(false);
    if (error) setErro(traduzirErro(error.message));
    else aoSalvar();
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      {erro && <Aviso>{erro}</Aviso>}
      <div className="grid gap-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
        <Campo rotulo="Número" name="numero" type="number" min={1} defaultValue={inicial?.numero ?? proximoNumero} required />
        <Campo rotulo="Tema da aula" name="titulo" defaultValue={inicial?.titulo} placeholder="Prepositions of movement" required />
      </div>
      <Campo rotulo="Frase de abertura" name="subtitulo" defaultValue={inicial?.subtitulo} placeholder="Vamos aprender como indicar a direção certa?" dica="Aparece em itálico, como na capa dos materiais." />
      <Campo rotulo="Link do material (PDF)" name="material_url" type="url" defaultValue={inicial?.material_url} placeholder="https://drive.google.com/…" dica="Opcional. Pode ser um link do Google Drive com acesso para quem tiver o link." />
      <div className="flex flex-wrap gap-2">
        <Botao type="submit" carregando={salvando}>{inicial ? "Salvar aula" : "Adicionar aula"}</Botao>
        <Botao type="button" variante="secundario" onClick={aoCancelar}>Cancelar</Botao>
      </div>
    </form>
  );
}

export default function Curso() {
  const { id = "" } = useParams();
  const navegar = useNavigate();
  const [editandoCurso, setEditandoCurso] = useState(false);
  const [aulaEmEdicao, setAulaEmEdicao] = useState<string | "nova" | null>(null);
  const [erroAcao, setErroAcao] = useState("");
  const { dados: curso, erro, carregando, recarregar } = useConsulta<CursoComAulas>(
    () => supabase.from("cursos").select("*, aulas(*)").eq("id", id).order("numero", { referencedTable: "aulas" }).single(),
    [id],
  );

  if (carregando) return <TextoCarregando />;
  if (erro || !curso) return <Aviso>{erro || "Curso não encontrado."}</Aviso>;

  curso.aulas.sort((a, b) => a.numero - b.numero);
  const proximoNumero = Math.max(0, ...curso.aulas.map((a) => a.numero)) + 1;

  async function apagarCurso() {
    if (!curso || !confirm(`Apagar o curso "${curso.titulo}"? As aulas e as turmas dele também serão apagadas.`)) return;
    const { error } = await supabase.from("cursos").delete().eq("id", curso.id);
    if (error) setErroAcao(traduzirErro(error.message));
    else navegar("/cursos", { replace: true });
  }

  async function apagarAula(aula: Aula) {
    if (!confirm(`Apagar a aula ${aula.numero} — ${aula.titulo}?`)) return;
    const { error } = await supabase.from("aulas").delete().eq("id", aula.id);
    if (error) setErroAcao(traduzirErro(error.message));
    else recarregar();
  }

  const fecharEdicao = () => setAulaEmEdicao(null);
  const salvarAula = () => {
    setAulaEmEdicao(null);
    recarregar();
  };

  return (
    <>
      <Link to="/cursos" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-suave hover:text-texto">
        <ArrowLeft className="size-4" /> Cursos
      </Link>

      {editandoCurso ? (
        <Cartao className="mb-8">
          <h2 className="mb-4 text-xl font-bold text-marca">Editar curso</h2>
          <FormularioCurso
            inicial={curso}
            aoCancelar={() => setEditandoCurso(false)}
            aoSalvar={() => {
              setEditandoCurso(false);
              recarregar();
            }}
          />
        </Cartao>
      ) : (
        <CabecalhoPagina
          etiqueta={`${IDIOMAS[curso.idioma]} · ${nomeNivel(curso.idioma, curso.nivel)}`}
          titulo={curso.titulo}
          descricao={curso.descricao || undefined}
          acoes={
            <div className="flex gap-2">
              <Botao variante="secundario" onClick={() => setEditandoCurso(true)}><Pencil className="size-4" /> Editar</Botao>
              <Botao variante="fantasma" onClick={apagarCurso} aria-label="Apagar curso" title="Apagar curso"><Trash2 className="size-4" /></Botao>
            </div>
          }
        />
      )}

      {erroAcao && <div className="mb-4"><Aviso>{erroAcao}</Aviso></div>}

      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-marca">Aulas</h2>
        {curso.aulas.length > 0 && aulaEmEdicao !== "nova" && (
          <Botao onClick={() => setAulaEmEdicao("nova")}><Plus className="size-4" /> Nova aula</Botao>
        )}
      </div>

      {aulaEmEdicao === "nova" && (
        <Cartao className="mb-4">
          <h3 className="mb-4 text-lg font-bold text-marca">Nova aula</h3>
          <FormularioAula cursoId={curso.id} proximoNumero={proximoNumero} aoSalvar={salvarAula} aoCancelar={fecharEdicao} />
        </Cartao>
      )}

      {curso.aulas.length === 0 && aulaEmEdicao !== "nova" ? (
        <EstadoVazio
          icone={NotebookPen}
          titulo="Adicione a primeira aula"
          texto="Cada aula tem um tema, uma frase de abertura e, se quiser, o link do material em PDF. As listas de exercícios entram dentro dela."
          acao={<Botao onClick={() => setAulaEmEdicao("nova")}><Plus className="size-4" /> Nova aula</Botao>}
        />
      ) : (
        <ol className="space-y-3">
          {curso.aulas.map((aula) =>
            aulaEmEdicao === aula.id ? (
              <li key={aula.id}>
                <Cartao>
                  <FormularioAula cursoId={curso.id} inicial={aula} proximoNumero={proximoNumero} aoSalvar={salvarAula} aoCancelar={fecharEdicao} />
                </Cartao>
              </li>
            ) : (
              <li key={aula.id} className="flex items-center gap-4 rounded-2xl border border-borda bg-superficie p-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-marinho-800 font-serif text-lg font-bold text-white">
                  {aula.numero}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-lg font-bold text-marca">{aula.titulo}</h3>
                  {aula.subtitulo && <p className="truncate font-serif text-suave italic">{aula.subtitulo}</p>}
                </div>
                {aula.material_url && (
                  <a href={aula.material_url} target="_blank" rel="noreferrer" className="hidden sm:block">
                    <Etiqueta><ExternalLink className="mr-1 size-3.5" /> Material</Etiqueta>
                  </a>
                )}
                <div className="flex shrink-0">
                  <Botao variante="fantasma" className="px-3" onClick={() => setAulaEmEdicao(aula.id)} aria-label={`Editar aula ${aula.numero}`} title="Editar">
                    <Pencil className="size-4" />
                  </Botao>
                  <Botao variante="fantasma" className="px-3" onClick={() => apagarAula(aula)} aria-label={`Apagar aula ${aula.numero}`} title="Apagar">
                    <Trash2 className="size-4" />
                  </Botao>
                </div>
              </li>
            ),
          )}
        </ol>
      )}
    </>
  );
}
