import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowDown, ArrowLeft, ArrowUp, ClipboardList, Eye, FileText, GripVertical, Link2, NotebookPen, Pencil, Plus, Trash2, Upload, UsersRound } from "lucide-react";
import { supabase, traduzirErro } from "../lib/supabase";
import { IDIOMAS, nomeNivel, useConsulta, type Aula, type Curso as TipoCurso } from "../lib/dados";
import { CabecalhoPagina } from "../componentes/Painel";
import { Aviso, Botao, Campo, Cartao, Etiqueta, EstadoVazio, TextoCarregando } from "../componentes/ui";
import { FormularioCurso } from "./Cursos";
import ExerciciosDaAula from "../componentes/ExerciciosDaAula";
import { TAMANHO_MAXIMO_MB, enviarMaterial } from "../lib/materiais";

type CursoComAulas = TipoCurso & { aulas: (Aula & { aula_listas: { lista_id: string; ordem: number }[] })[]; turmas: { id: string; nome: string }[] };

type AulaCompleta = Aula & { aula_listas: { lista_id: string; ordem: number }[] };
type ModoMaterial = "nenhum" | "arquivo" | "link";

function FormularioAula({ cursoId, inicial, proximoNumero, aoSalvar, aoCancelar }: {
  cursoId: string;
  inicial?: AulaCompleta;
  proximoNumero: number;
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [modo, setModo] = useState<ModoMaterial>(inicial?.material_arquivo ? "arquivo" : inicial?.material_url ? "link" : "nenhum");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [exercicios, setExercicios] = useState<string[]>(
    [...(inicial?.aula_listas ?? [])].sort((a, b) => a.ordem - b.ordem).map((l) => l.lista_id),
  );

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    setErro("");
    if (modo === "arquivo" && !arquivo && !inicial?.material_arquivo) {
      setErro("Escolha o PDF da aula ou mude a opção de material.");
      return;
    }
    setSalvando(true);
    try {
      // 1. Material: envia o PDF novo (se houver) antes de gravar a aula.
      let material = { material_url: "", material_arquivo: "", material_nome: "" };
      if (modo === "link") material.material_url = String(dados.get("material_url") ?? "").trim();
      if (modo === "arquivo") {
        material = arquivo
          ? { material_url: "", ...(await enviarMaterial(arquivo).then((r) => ({ material_arquivo: r.caminho, material_nome: r.nome }))) }
          : { material_url: "", material_arquivo: inicial!.material_arquivo, material_nome: inicial!.material_nome };
      }
      const aula = {
        numero: Number(dados.get("numero")),
        titulo: String(dados.get("titulo")).trim(),
        subtitulo: String(dados.get("subtitulo")).trim(),
        ...material,
      };

      // 2. A aula em si.
      let idAula = inicial?.id;
      if (inicial) {
        const { error } = await supabase.from("aulas").update(aula).eq("id", inicial.id);
        if (error) throw new Error(traduzirErro(error.message));
      } else {
        const { data, error } = await supabase.from("aulas").insert({ ...aula, curso_id: cursoId }).select("id").single();
        if (error || !data) throw new Error(traduzirErro(error?.message ?? "Não foi possível criar a aula."));
        idAula = data.id;
      }

      // 3. Exercícios da aula: regrava a lista inteira na ordem escolhida.
      const { error: erroApagar } = await supabase.from("aula_listas").delete().eq("aula_id", idAula!);
      if (erroApagar) throw new Error(traduzirErro(erroApagar.message));
      if (exercicios.length) {
        const { error } = await supabase.from("aula_listas").insert(exercicios.map((lista_id, ordem) => ({ aula_id: idAula, lista_id, ordem })));
        if (error) throw new Error(traduzirErro(error.message));
      }

      // 4. O PDF antigo sai do bucket quando foi trocado ou removido.
      if (inicial?.material_arquivo && inicial.material_arquivo !== material.material_arquivo) {
        await supabase.storage.from("materiais").remove([inicial.material_arquivo]);
      }
      aoSalvar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-5">
      {erro && <Aviso>{erro}</Aviso>}
      <div className="grid gap-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
        <Campo rotulo="Número" name="numero" type="number" min={1} defaultValue={inicial?.numero ?? proximoNumero} required />
        <Campo rotulo="Tema da aula" name="titulo" defaultValue={inicial?.titulo} placeholder="Prepositions of movement" required />
      </div>
      <Campo rotulo="Frase de abertura" name="subtitulo" defaultValue={inicial?.subtitulo} placeholder="Vamos aprender como indicar a direção certa?" dica="Aparece em itálico, como na capa dos materiais." />

      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold text-texto">Material da aula</legend>
        <div className="mb-3 flex flex-wrap gap-2" role="radiogroup">
          {(
            [
              ["nenhum", "Sem material"],
              ["arquivo", "Enviar PDF"],
              ["link", "Colar link"],
            ] as const
          ).map(([valor, rotulo]) => (
            <label key={valor} className={`cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-semibold ${modo === valor ? "bg-marca text-sobre-marca" : "border border-borda text-suave hover:text-texto"}`}>
              <input type="radio" name="modo_material" value={valor} checked={modo === valor} onChange={() => setModo(valor)} className="sr-only" />
              {rotulo}
            </label>
          ))}
        </div>
        {modo === "arquivo" && (
          <div className="rounded-xl border-2 border-dashed border-borda p-4">
            {inicial?.material_arquivo && !arquivo && (
              <p className="mb-2 flex items-center gap-2 text-sm"><FileText className="size-4 text-marca" /> Atual: <strong>{inicial.material_nome}</strong></p>
            )}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-borda bg-superficie px-4 py-2.5 text-sm font-semibold hover:bg-fundo">
              <Upload className="size-4" /> {arquivo ? "Trocar arquivo" : inicial?.material_arquivo ? "Enviar outro PDF" : "Escolher PDF"}
              <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
            </label>
            {arquivo && <p className="mt-2 text-sm">Novo: <strong>{arquivo.name}</strong> ({(arquivo.size / 1024 / 1024).toFixed(1)} MB) — sobe quando você salvar.</p>}
            <p className="mt-2 text-xs text-suave">Até {TAMANHO_MAXIMO_MB} MB. Fica guardado de forma privada: só a equipe e os alunos com a aula liberada abrem.</p>
          </div>
        )}
        {modo === "link" && (
          <Campo
            rotulo="Link do material"
            name="material_url"
            type="url"
            defaultValue={inicial?.material_url}
            placeholder="https://drive.google.com/file/d/…/view"
            dica="Google Drive, Docs ou Slides (com acesso para quem tiver o link) abrem dentro do site. Outros links de PDF também funcionam."
          />
        )}
      </fieldset>

      <div>
        <ExerciciosDaAula selecionadas={exercicios} aoMudar={setExercicios} />
        {inicial ? (
          <Link to={`/exercicios/nova?aula=${inicial.id}`} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-destaque hover:underline">
            <Plus className="size-4" /> Criar um exercício novo para esta aula
          </Link>
        ) : (
          <p className="mt-2 text-xs text-suave">Depois de salvar a aula, dá para criar um exercício novo direto nela.</p>
        )}
      </div>

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
  // Reordenar: enquanto arrasta, a ordem nova fica só na tela; ao soltar, os números são gravados.
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [ordemLocal, setOrdemLocal] = useState<string[] | null>(null);
  const [avisoOrdem, setAvisoOrdem] = useState("");
  const { dados: curso, erro, carregando, recarregar } = useConsulta<CursoComAulas>(
    () => supabase.from("cursos").select("*, aulas(*, aula_listas(lista_id, ordem)), turmas(id, nome)").eq("id", id).order("numero", { referencedTable: "aulas" }).single(),
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
    else {
      if (aula.material_arquivo) await supabase.storage.from("materiais").remove([aula.material_arquivo]);
      recarregar();
    }
  }

  const porId = new Map(curso.aulas.map((a) => [a.id, a]));
  const aulasNaTela = ordemLocal ? ordemLocal.map((idAula) => porId.get(idAula)!).filter(Boolean) : curso.aulas;

  function moverPara(idAula: string, destino: number) {
    const ids = (ordemLocal ?? curso!.aulas.map((a) => a.id)).filter((x) => x !== idAula);
    ids.splice(Math.max(0, Math.min(destino, ids.length)), 0, idAula);
    setOrdemLocal(ids);
    return ids;
  }

  /** Renumera as aulas na ordem da tela (1, 2, 3...) e grava só as que mudaram. */
  async function gravarOrdem(ids: string[]) {
    setArrastando(null);
    const mudaram = ids.map((idAula, i) => ({ idAula, numero: i + 1 })).filter(({ idAula, numero }) => porId.get(idAula)?.numero !== numero);
    if (mudaram.length === 0) {
      setOrdemLocal(null);
      return;
    }
    setErroAcao("");
    const respostas = await Promise.all(mudaram.map(({ idAula, numero }) => supabase.from("aulas").update({ numero }).eq("id", idAula)));
    const falha = respostas.find((r) => r.error);
    if (falha?.error) setErroAcao(traduzirErro(falha.error.message));
    else {
      setAvisoOrdem("Nova ordem salva. As turmas veem as aulas nessa ordem.");
      setTimeout(() => setAvisoOrdem(""), 3000);
    }
    await recarregar();
    setOrdemLocal(null);
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

      <div className="mb-8 flex flex-wrap items-center gap-2 rounded-2xl border border-borda bg-superficie px-4 py-3 text-sm">
        <UsersRound className="size-4 text-suave" />
        {curso.turmas.length === 0 ? (
          <span className="text-suave">Nenhuma turma segue este curso ainda. <Link to="/turmas" className="font-semibold text-destaque underline">Criar turma</Link></span>
        ) : (
          <>
            <span className="text-suave">Turmas que seguem este curso:</span>
            {curso.turmas.map((t) => (
              <Link key={t.id} to={`/turmas/${t.id}`} className="rounded-full bg-destaque-suave px-3 py-1 font-semibold text-marca hover:underline">{t.nome}</Link>
            ))}
            <span className="text-xs text-suave">Cada turma libera as aulas no próprio ritmo.</span>
          </>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-marca">Aulas</h2>
          {curso.aulas.length > 1 && <p className="text-sm text-suave">Para mudar a ordem, arraste pela alça <GripVertical className="inline size-4 align-text-bottom" /> ou use as setas.</p>}
        </div>
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
          texto="Cada aula tem um tema, uma frase de abertura, o material em PDF (arquivo ou link) e os exercícios que aparecem no fim."
          acao={<Botao onClick={() => setAulaEmEdicao("nova")}><Plus className="size-4" /> Nova aula</Botao>}
        />
      ) : (
        <ol className="space-y-3">
          {avisoOrdem && <li className="rounded-xl bg-sucesso-suave px-4 py-2 text-sm text-sucesso">{avisoOrdem}</li>}
          {aulasNaTela.map((aula, posicao) =>
            aulaEmEdicao === aula.id ? (
              <li key={aula.id}>
                <Cartao>
                  <FormularioAula cursoId={curso.id} inicial={aula} proximoNumero={proximoNumero} aoSalvar={salvarAula} aoCancelar={fecharEdicao} />
                </Cartao>
              </li>
            ) : (
              <li
                key={aula.id}
                draggable={!aulaEmEdicao}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  setArrastando(aula.id);
                }}
                onDragOver={(e) => {
                  if (!arrastando || arrastando === aula.id) return;
                  e.preventDefault();
                  moverPara(arrastando, posicao);
                }}
                onDrop={(e) => e.preventDefault()}
                onDragEnd={() => arrastando && gravarOrdem(ordemLocal ?? curso.aulas.map((a) => a.id))}
                className={`flex flex-wrap items-center gap-3 rounded-2xl border bg-superficie p-4 transition sm:flex-nowrap sm:gap-4 ${
                  arrastando === aula.id ? "border-destaque opacity-60 shadow-lg" : "border-borda"
                }`}
              >
                {curso.aulas.length > 1 && (
                  <span className="flex shrink-0 flex-col items-center">
                    <button
                      type="button"
                      onClick={() => gravarOrdem(moverPara(aula.id, posicao - 1))}
                      disabled={posicao === 0}
                      aria-label={`Subir aula ${aula.titulo}`}
                      className="grid size-6 place-items-center rounded text-suave hover:bg-fundo hover:text-texto disabled:opacity-30"
                    >
                      <ArrowUp className="size-3.5" />
                    </button>
                    <GripVertical className="hidden size-5 cursor-grab text-suave active:cursor-grabbing sm:block" aria-hidden="true" />
                    <button
                      type="button"
                      onClick={() => gravarOrdem(moverPara(aula.id, posicao + 1))}
                      disabled={posicao === aulasNaTela.length - 1}
                      aria-label={`Descer aula ${aula.titulo}`}
                      className="grid size-6 place-items-center rounded text-suave hover:bg-fundo hover:text-texto disabled:opacity-30"
                    >
                      <ArrowDown className="size-3.5" />
                    </button>
                  </span>
                )}
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-marinho-800 font-serif text-lg font-bold text-white">
                  {ordemLocal ? posicao + 1 : aula.numero}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-lg font-bold text-marca">{aula.titulo}</h3>
                  {aula.subtitulo && <p className="truncate font-serif text-suave italic">{aula.subtitulo}</p>}
                </div>
                <div className="hidden flex-wrap gap-1.5 sm:flex">
                  {aula.material_arquivo && <Etiqueta><FileText className="mr-1 size-3.5" /> PDF</Etiqueta>}
                  {!aula.material_arquivo && aula.material_url && <Etiqueta><Link2 className="mr-1 size-3.5" /> Link</Etiqueta>}
                  {aula.aula_listas.length > 0 && (
                    <Etiqueta tom="creme"><ClipboardList className="mr-1 size-3.5" /> {aula.aula_listas.length} {aula.aula_listas.length === 1 ? "exercício" : "exercícios"}</Etiqueta>
                  )}
                </div>
                <div className="flex w-full shrink-0 justify-end border-t border-borda pt-2 sm:w-auto sm:border-0 sm:pt-0">
                  <Link
                    to={`/exercicios/nova?aula=${aula.id}`}
                    className="inline-flex h-11 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-destaque hover:bg-destaque-suave"
                    title="Criar um exercício novo que já entra nesta aula"
                  >
                    <Plus className="size-4" /> Exercício
                  </Link>
                  <Link to={`/aulas/${aula.id}`} className="inline-flex h-11 items-center rounded-xl px-3 text-suave hover:bg-fundo hover:text-texto" aria-label={`Ver aula ${aula.numero} como aluno`} title="Ver como aluno">
                    <Eye className="size-4" />
                  </Link>
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
