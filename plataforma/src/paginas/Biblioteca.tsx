import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { CheckCircle2, ExternalLink, FileStack, FolderUp, Loader2, Search, Trash2, TriangleAlert, Upload, X } from "lucide-react";
import { supabase, traduzirErro } from "../lib/supabase";
import { IDIOMAS, nomeNivel, useConsulta, type Idioma } from "../lib/dados";
import { CEFR, ORDEM_IDIOMAS } from "../lib/idiomas";
import {
  CAMPOS_MATERIAL, abrirMaterial, adicionarABiblioteca, erroDeArquivo, nivelDoNome, ordemNatural, tamanhoLegivel, tituloDoArquivo, usosDosMateriais, type Material,
} from "../lib/biblioteca";
import { CabecalhoPagina } from "../componentes/Painel";
import { Aviso, Botao, Etiqueta, EstadoVazio, TextoCarregando } from "../componentes/ui";

const CHAVE_IDIOMA = "up:biblioteca:idioma";
const CONTROLE = "h-10 rounded-xl border border-borda bg-superficie px-3 text-sm focus:border-destaque focus:outline-none";

const opcoesDeNivel = (idioma: Idioma) => CEFR.map((c, i) => ({ valor: i + 1, rotulo: `${c} · ${nomeNivel(idioma, i + 1)}` }));

// ---------------------------------------------------------------------------
// Envio em lote
// ---------------------------------------------------------------------------

type ItemEnvio = { id: string; arquivo: File; titulo: string; estado: "pronto" | "enviando" | "ok" | "erro" | "pulado"; mensagem: string };

/** Pastas arrastadas para a página: lê os PDFs de dentro, em todos os níveis. */
async function arquivosDoDrop(dt: DataTransfer): Promise<File[]> {
  const entradas = [...dt.items].map((i) => i.webkitGetAsEntry?.()).filter((e): e is FileSystemEntry => !!e);
  if (entradas.length === 0) return [...dt.files];
  const arquivos: File[] = [];
  async function visitar(entrada: FileSystemEntry): Promise<void> {
    if (entrada.isFile) {
      arquivos.push(await new Promise<File>((resolve, reject) => (entrada as FileSystemFileEntry).file(resolve, reject)));
      return;
    }
    const leitor = (entrada as FileSystemDirectoryEntry).createReader();
    for (;;) {
      const lote = await new Promise<FileSystemEntry[]>((resolve, reject) => leitor.readEntries(resolve, reject));
      if (lote.length === 0) break;
      for (const filho of lote) await visitar(filho);
    }
  }
  for (const entrada of entradas) await visitar(entrada);
  return arquivos;
}

function ZonaDeEnvio({ materiais, aoTerminar }: { materiais: Material[]; aoTerminar: () => void }) {
  const [idioma, setIdioma] = useState<Idioma>(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_IDIOMA) as Idioma | null;
      return salvo && salvo in IDIOMAS ? salvo : "ingles";
    } catch {
      return "ingles";
    }
  });
  const [nivel, setNivel] = useState<number | null>(null);
  const [itens, setItens] = useState<ItemEnvio[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const entradaArquivos = useRef<HTMLInputElement>(null);
  const entradaPasta = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_IDIOMA, idioma);
    } catch {
      /* sem armazenamento: só não lembra */
    }
  }, [idioma]);

  function adicionar(arquivos: File[]) {
    const pdfs = arquivos.filter((a) => a.name.toLowerCase().endsWith(".pdf") || a.type === "application/pdf");
    const novos: ItemEnvio[] = pdfs.map((arquivo) => {
      const erro = erroDeArquivo(arquivo);
      const repetido =
        materiais.some((m) => m.nome_original === arquivo.name && m.tamanho === arquivo.size) ||
        itens.some((i) => i.arquivo.name === arquivo.name && i.arquivo.size === arquivo.size);
      return {
        id: crypto.randomUUID(),
        arquivo,
        titulo: tituloDoArquivo(arquivo.name),
        estado: erro || repetido ? "pulado" : "pronto",
        mensagem: erro ?? (repetido ? "Já está na biblioteca (mesmo nome e tamanho)." : ""),
      };
    });
    novos.sort((a, b) => ordemNatural(a.arquivo.name, b.arquivo.name));
    setItens((atuais) => [...atuais, ...novos]);
  }

  async function enviar() {
    const fila = itens.filter((i) => i.estado === "pronto");
    if (fila.length === 0) return;
    setEnviando(true);
    const mudar = (id: string, parcial: Partial<ItemEnvio>) => setItens((atuais) => atuais.map((i) => (i.id === id ? { ...i, ...parcial } : i)));
    let proximo = 0;
    // Dois envios por vez: rápido sem sobrecarregar a conexão.
    const trabalhador = async () => {
      while (proximo < fila.length) {
        const item = fila[proximo++];
        mudar(item.id, { estado: "enviando" });
        try {
          await adicionarABiblioteca(item.arquivo, { idioma, nivel, titulo: item.titulo });
          mudar(item.id, { estado: "ok", mensagem: "" });
        } catch (e) {
          mudar(item.id, { estado: "erro", mensagem: (e as Error).message });
        }
      }
    };
    await Promise.all([trabalhador(), trabalhador()]);
    setEnviando(false);
    aoTerminar();
  }

  const prontos = itens.filter((i) => i.estado === "pronto").length;
  const feitos = itens.filter((i) => i.estado === "ok").length;
  const problemas = itens.filter((i) => i.estado === "erro").length;

  async function aoSoltar(evento: DragEvent) {
    evento.preventDefault();
    setArrastando(false);
    adicionar(await arquivosDoDrop(evento.dataTransfer));
  }

  return (
    <section className="mb-8 rounded-2xl border border-borda bg-superficie p-5 sm:p-6" aria-label="Enviar PDFs">
      <h2 className="text-lg font-bold text-marca">Enviar aulas em PDF</h2>
      <p className="mb-4 text-sm text-suave">Escolha o idioma, solte vários PDFs de uma vez (ou uma pasta inteira) e envie. O título sai do nome do arquivo e dá para ajustar depois.</p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-semibold">
          Idioma
          <select value={idioma} onChange={(e) => { setIdioma(e.target.value as Idioma); setNivel(null); }} className={CONTROLE}>
            {ORDEM_IDIOMAS.map((i) => <option key={i} value={i}>{IDIOMAS[i]}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          Nível
          <select value={nivel ?? ""} onChange={(e) => setNivel(e.target.value ? Number(e.target.value) : null)} className={CONTROLE}>
            <option value="">Definir depois</option>
            {opcoesDeNivel(idioma).map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </select>
        </label>
        <span className="text-xs text-suave">Vale para todos os PDFs deste envio. Se o nome tiver o nível (Beginner, Elementary, A2...), ele é reconhecido.</span>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={aoSoltar}
        className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${arrastando ? "border-destaque bg-destaque-suave" : "border-borda"}`}
      >
        <Upload className="mx-auto mb-2 size-7 text-suave" />
        <p className="font-semibold">Arraste os PDFs ou uma pasta para cá</p>
        <p className="mb-3 text-xs text-suave">Até 50 MB por arquivo.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Botao type="button" variante="secundario" onClick={() => entradaArquivos.current?.click()}><FileStack className="size-4" /> Escolher PDFs</Botao>
          <Botao type="button" variante="secundario" onClick={() => entradaPasta.current?.click()}><FolderUp className="size-4" /> Escolher pasta</Botao>
        </div>
        <input ref={entradaArquivos} type="file" accept="application/pdf,.pdf" multiple className="sr-only" onChange={(e) => { adicionar([...(e.target.files ?? [])]); e.target.value = ""; }} />
        {/* webkitdirectory não está nos tipos do React, mas funciona em todos os navegadores atuais. */}
        <input ref={entradaPasta} type="file" multiple className="sr-only" {...{ webkitdirectory: "", directory: "" }} onChange={(e) => { adicionar([...(e.target.files ?? [])]); e.target.value = ""; }} />
      </div>

      {itens.length > 0 && (
        <div className="mt-5">
          <ul className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-borda p-2">
            {itens.map((item) => (
              <li key={item.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm">
                <span className="w-5 shrink-0">
                  {item.estado === "enviando" && <Loader2 className="size-4 animate-spin text-destaque" />}
                  {item.estado === "ok" && <CheckCircle2 className="size-4 text-sucesso" />}
                  {item.estado === "erro" && <TriangleAlert className="size-4 text-erro" />}
                  {item.estado === "pulado" && <TriangleAlert className="size-4 text-suave" />}
                </span>
                <span className="min-w-0 flex-1">
                  {item.estado === "pronto" ? (
                    <input
                      value={item.titulo}
                      onChange={(e) => setItens((atuais) => atuais.map((i) => (i.id === item.id ? { ...i, titulo: e.target.value } : i)))}
                      aria-label={`Título de ${item.arquivo.name}`}
                      className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 font-semibold hover:border-borda focus:border-destaque focus:outline-none"
                    />
                  ) : (
                    <span className="block truncate font-semibold">{item.titulo}</span>
                  )}
                  <span className="block truncate text-xs text-suave">{item.mensagem || `${item.arquivo.name} · ${tamanhoLegivel(item.arquivo.size)}`}</span>
                </span>
                {item.estado !== "enviando" && item.estado !== "ok" && (
                  <button onClick={() => setItens((atuais) => atuais.filter((i) => i.id !== item.id))} aria-label="Tirar da lista" className="grid size-7 place-items-center pointer-coarse:size-11 rounded-md text-suave hover:bg-fundo"><X className="size-4" /></button>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Botao onClick={enviar} carregando={enviando} disabled={prontos === 0}>
              {prontos === 0 ? "Nada para enviar" : `Enviar ${prontos} ${prontos === 1 ? "PDF" : "PDFs"}`}
            </Botao>
            <button onClick={() => setItens([])} disabled={enviando} className="text-sm font-semibold text-suave hover:text-texto disabled:opacity-40">Limpar lista</button>
            {(feitos > 0 || problemas > 0) && (
              <span className="text-sm text-suave">{feitos} {feitos === 1 ? "enviado" : "enviados"}{problemas > 0 && ` · ${problemas} com problema (veja acima)`}</span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// A biblioteca
// ---------------------------------------------------------------------------

export default function Biblioteca() {
  const { dados, erro, carregando, recarregar, setDados } = useConsulta<Material[]>(() =>
    supabase.from("materiais").select(CAMPOS_MATERIAL).order("criado_em", { ascending: false }),
  );
  const { dados: usos, recarregar: recarregarUsos } = useConsulta<Map<string, number>>(() => usosDosMateriais());
  const [filtroIdioma, setFiltroIdioma] = useState<Idioma | "todos">("todos");
  const [filtroNivel, setFiltroNivel] = useState<"todos" | "sem" | number>("todos");
  const [busca, setBusca] = useState("");
  const [apenasLivres, setApenasLivres] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [erroAcao, setErroAcao] = useState("");

  const todos = dados ?? [];
  const usosDe = (m: Material) => usos?.get(m.arquivo) ?? 0;
  const termo = busca.trim().toLowerCase();
  const visiveis = useMemo(
    () =>
      todos
        .filter(
          (m) =>
            (filtroIdioma === "todos" || m.idioma === filtroIdioma) &&
            (filtroNivel === "todos" || (filtroNivel === "sem" ? m.nivel === null : m.nivel === filtroNivel)) &&
            (!apenasLivres || (usos?.get(m.arquivo) ?? 0) === 0) &&
            (!termo || `${m.titulo} ${m.nome_original}`.toLowerCase().includes(termo)),
        )
        .sort(
          (a, b) =>
            ORDEM_IDIOMAS.indexOf(a.idioma) - ORDEM_IDIOMAS.indexOf(b.idioma) ||
            (a.nivel ?? 99) - (b.nivel ?? 99) ||
            ordemNatural(a.titulo, b.titulo),
        ),
    [todos, usos, filtroIdioma, filtroNivel, apenasLivres, termo],
  );
  const semNivel = todos.filter((m) => m.nivel === null).length;
  const marcadosVisiveis = visiveis.filter((m) => marcados.has(m.id));

  async function atualizar(ids: string[], parcial: Partial<Pick<Material, "titulo" | "idioma" | "nivel">>) {
    setErroAcao("");
    setDados(todos.map((m) => (ids.includes(m.id) ? { ...m, ...parcial } : m)));
    const { error } = await supabase.from("materiais").update(parcial).in("id", ids);
    if (error) {
      setErroAcao(traduzirErro(error.message));
      recarregar();
    }
  }

  async function apagar(lista: Material[]) {
    const livres = lista.filter((m) => usosDe(m) === 0);
    if (livres.length === 0) return setErroAcao("Esses PDFs estão em uso por aulas. Tire-os das aulas antes de apagar.");
    const aviso = livres.length < lista.length ? ` (${lista.length - livres.length} em uso ficam)` : "";
    if (!confirm(`Apagar ${livres.length} ${livres.length === 1 ? "PDF" : "PDFs"} da biblioteca${aviso}? Não dá para desfazer.`)) return;
    setErroAcao("");
    const { error } = await supabase.from("materiais").delete().in("id", livres.map((m) => m.id));
    if (error) return setErroAcao(traduzirErro(error.message));
    await supabase.storage.from("materiais").remove(livres.map((m) => m.arquivo));
    setMarcados(new Set());
    recarregar();
  }

  async function abrir(m: Material) {
    try {
      await abrirMaterial(m.arquivo);
    } catch (e) {
      setErroAcao((e as Error).message);
    }
  }

  const alternar = (id: string) =>
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  const todosMarcados = visiveis.length > 0 && marcadosVisiveis.length === visiveis.length;

  return (
    <>
      <CabecalhoPagina
        etiqueta="Biblioteca"
        titulo="Aulas em PDF"
        descricao="Os slides das aulas ficam guardados aqui, uma vez só. Na hora de montar um curso, é só escolher o PDF, sem enviar de novo e sem procurar no Drive."
      />

      <ZonaDeEnvio materiais={todos} aoTerminar={() => { recarregar(); recarregarUsos(); }} />

      {(erro || erroAcao) && <div className="mb-4"><Aviso>{erro || erroAcao}</Aviso></div>}
      {carregando && !dados && <TextoCarregando />}

      {dados && todos.length === 0 && (
        <EstadoVazio icone={FileStack} titulo="A biblioteca está vazia" texto="Envie os PDFs das aulas acima. Eles ficam guardados e prontos para qualquer curso." />
      )}

      {todos.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {(["todos", ...ORDEM_IDIOMAS] as const).map((i) => (
              <button
                key={i}
                onClick={() => setFiltroIdioma(i)}
                aria-pressed={filtroIdioma === i}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${filtroIdioma === i ? "bg-marca text-sobre-marca" : "border border-borda bg-superficie text-suave hover:text-texto"}`}
              >
                {i === "todos" ? `Todos (${todos.length})` : `${IDIOMAS[i]} (${todos.filter((m) => m.idioma === i).length})`}
              </button>
            ))}
            <label className="ml-auto">
              <span className="sr-only">Nível</span>
              <select
                value={String(filtroNivel)}
                onChange={(e) => setFiltroNivel(e.target.value === "todos" || e.target.value === "sem" ? e.target.value : Number(e.target.value))}
                className={CONTROLE}
              >
                <option value="todos">Todos os níveis</option>
                <option value="sem">Sem nível ({semNivel})</option>
                {CEFR.map((c, i) => <option key={c} value={i + 1}>{c}</option>)}
              </select>
            </label>
          </div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative flex-1">
              <span className="sr-only">Buscar PDF</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-suave" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pelo título ou nome do arquivo" className={`${CONTROLE} w-full pl-9`} />
            </label>
            <label className="flex items-center gap-2 text-sm text-suave">
              <input type="checkbox" checked={apenasLivres} onChange={(e) => setApenasLivres(e.target.checked)} className="size-4 accent-[var(--c-marca)]" />
              Só os que nenhuma aula usa
            </label>
          </div>

          {semNivel > 0 && filtroNivel !== "sem" && (
            <p className="mb-4 flex items-center gap-2 rounded-xl bg-coral-suave px-3 py-2 text-sm">
              <TriangleAlert className="size-4 shrink-0 text-coral" /> {semNivel} {semNivel === 1 ? "PDF está" : "PDFs estão"} sem nível. Marque vários e use "Definir nível" para organizar de uma vez.
              <button onClick={() => setFiltroNivel("sem")} className="ml-auto font-semibold text-destaque hover:underline">Ver</button>
            </p>
          )}

          {marcadosVisiveis.length > 0 && (
            <div className="sticky top-2 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-destaque bg-superficie p-3 shadow-md">
              <strong className="text-sm">{marcadosVisiveis.length} {marcadosVisiveis.length === 1 ? "selecionado" : "selecionados"}</strong>
              <select
                value=""
                onChange={(e) => e.target.value && atualizar(marcadosVisiveis.map((m) => m.id), { nivel: e.target.value === "sem" ? null : Number(e.target.value) })}
                className={CONTROLE}
                aria-label="Definir nível dos selecionados"
              >
                <option value="">Definir nível…</option>
                {CEFR.map((c, i) => <option key={c} value={i + 1}>{c}</option>)}
                <option value="sem">Sem nível</option>
              </select>
              <select
                value=""
                onChange={(e) => e.target.value && atualizar(marcadosVisiveis.map((m) => m.id), { idioma: e.target.value as Idioma })}
                className={CONTROLE}
                aria-label="Definir idioma dos selecionados"
              >
                <option value="">Definir idioma…</option>
                {ORDEM_IDIOMAS.map((i) => <option key={i} value={i}>{IDIOMAS[i]}</option>)}
              </select>
              <Botao variante="secundario" onClick={() => apagar(marcadosVisiveis)}><Trash2 className="size-4" /> Apagar</Botao>
              <button onClick={() => setMarcados(new Set())} className="ml-auto text-sm font-semibold text-suave hover:text-texto">Limpar seleção</button>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-borda bg-superficie">
            <label className="flex items-center gap-3 border-b border-borda bg-fundo px-4 py-2.5 text-xs font-semibold text-suave uppercase">
              <input
                type="checkbox"
                checked={todosMarcados}
                onChange={() => setMarcados(todosMarcados ? new Set() : new Set(visiveis.map((m) => m.id)))}
                className="size-4 accent-[var(--c-marca)]"
              />
              Selecionar todos os {visiveis.length} da lista
            </label>
            {visiveis.length === 0 ? (
              <p className="p-6 text-center text-sm text-suave">Nenhum PDF com esses filtros.</p>
            ) : (
              <ul className="divide-y divide-borda">
                {visiveis.map((m) => (
                  <LinhaMaterial
                    key={m.id}
                    material={m}
                    usos={usosDe(m)}
                    marcado={marcados.has(m.id)}
                    aoMarcar={() => alternar(m.id)}
                    aoMudar={(parcial) => atualizar([m.id], parcial)}
                    aoAbrir={() => abrir(m)}
                    aoApagar={() => apagar([m])}
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </>
  );
}

function LinhaMaterial({ material: m, usos, marcado, aoMarcar, aoMudar, aoAbrir, aoApagar }: {
  material: Material;
  usos: number;
  marcado: boolean;
  aoMarcar: () => void;
  aoMudar: (parcial: Partial<Pick<Material, "titulo" | "idioma" | "nivel">>) => void;
  aoAbrir: () => void;
  aoApagar: () => void;
}) {
  const [titulo, setTitulo] = useState(m.titulo);
  useEffect(() => setTitulo(m.titulo), [m.titulo]);
  const sugerido = m.nivel === null ? nivelDoNome(m.nome_original) : null;

  return (
    <li className={`flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap ${marcado ? "bg-destaque-suave" : ""}`}>
      <input type="checkbox" checked={marcado} onChange={aoMarcar} aria-label={`Selecionar ${m.titulo}`} className="size-4 shrink-0 accent-[var(--c-marca)]" />
      <div className="min-w-0 flex-1 basis-60">
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onBlur={() => titulo.trim() && titulo.trim() !== m.titulo ? aoMudar({ titulo: titulo.trim() }) : setTitulo(m.titulo)}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          aria-label="Título"
          className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 font-serif text-lg font-bold text-marca hover:border-borda focus:border-destaque focus:outline-none"
        />
        <p className="truncate px-1 text-xs text-suave">{m.nome_original} · {tamanhoLegivel(m.tamanho)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select value={m.idioma} onChange={(e) => aoMudar({ idioma: e.target.value as Idioma })} aria-label="Idioma" className={`${CONTROLE} h-9`}>
          {ORDEM_IDIOMAS.map((i) => <option key={i} value={i}>{IDIOMAS[i]}</option>)}
        </select>
        <select
          value={m.nivel ?? ""}
          onChange={(e) => aoMudar({ nivel: e.target.value ? Number(e.target.value) : null })}
          aria-label="Nível"
          className={`${CONTROLE} h-9 ${m.nivel === null ? "border-coral text-coral" : ""}`}
        >
          <option value="">Sem nível</option>
          {opcoesDeNivel(m.idioma).map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </select>
        {sugerido && <Etiqueta tom="creme">sugestão: {CEFR[sugerido - 1]}</Etiqueta>}
        <Etiqueta tom={usos > 0 ? "verde" : "creme"}>{usos > 0 ? `${usos} ${usos === 1 ? "aula" : "aulas"}` : "Não usado"}</Etiqueta>
      </div>
      <div className="flex shrink-0">
        <button onClick={aoAbrir} title="Abrir o PDF" aria-label={`Abrir ${m.titulo}`} className="grid size-9 place-items-center pointer-coarse:size-11 rounded-lg text-suave hover:bg-fundo hover:text-texto"><ExternalLink className="size-4" /></button>
        <button
          onClick={aoApagar}
          disabled={usos > 0}
          title={usos > 0 ? "Em uso por aulas: tire das aulas antes de apagar" : "Apagar da biblioteca"}
          aria-label={`Apagar ${m.titulo}`}
          className="grid size-9 place-items-center pointer-coarse:size-11 rounded-lg text-suave hover:bg-erro-suave hover:text-erro disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-suave"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );
}
