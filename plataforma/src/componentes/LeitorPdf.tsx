import { useEffect, useRef, useState } from "react";
import { ExternalLink, FileText, Maximize2, Minimize2 } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { fonteDoMaterial, linkDoArquivo, type FonteMaterial } from "../lib/materiais";
import { Aviso } from "./ui";

/** Carrega o PDF.js só quando alguém abre uma aula (~1 MB entre biblioteca e worker). */
async function abrirPdf(url: string): Promise<PDFDocumentProxy> {
  const pdfjs = await import("pdfjs-dist");
  const { default: worker } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  return pdfjs.getDocument({ url }).promise;
}

/** Uma página do PDF: só é desenhada quando chega perto da tela (os slides das aulas passam de 30 páginas). */
function Pagina({ documento, numero, largura }: { documento: PDFDocumentProxy; numero: number; largura: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(numero <= 2);
  const [proporcao, setProporcao] = useState(9 / 16);

  useEffect(() => {
    if (visivel || !caixa.current) return;
    const observador = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) setVisivel(true);
    }, { rootMargin: "600px 0px" });
    observador.observe(caixa.current);
    return () => observador.disconnect();
  }, [visivel]);

  useEffect(() => {
    if (!visivel || !canvas.current || largura === 0) return;
    let cancelado = false;
    let tarefa: { cancel: () => void } | null = null;
    documento.getPage(numero).then((pagina) => {
      if (cancelado || !canvas.current) return;
      const base = pagina.getViewport({ scale: 1 });
      setProporcao(base.height / base.width);
      const densidade = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = pagina.getViewport({ scale: (largura / base.width) * densidade });
      canvas.current.width = viewport.width;
      canvas.current.height = viewport.height;
      const render = pagina.render({ canvas: canvas.current, viewport });
      tarefa = render;
      render.promise.catch(() => undefined);
    });
    return () => {
      cancelado = true;
      tarefa?.cancel();
    };
  }, [visivel, documento, numero, largura]);

  return (
    <div ref={caixa} className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-borda" style={{ aspectRatio: `1 / ${proporcao}` }}>
      <canvas ref={canvas} className="block h-full w-full" aria-label={`Página ${numero}`} role="img" />
    </div>
  );
}

function LeitorDeArquivo({ url, nome }: { url: string; nome: string }) {
  const area = useRef<HTMLDivElement>(null);
  const [documento, setDocumento] = useState<PDFDocumentProxy | null>(null);
  const [erro, setErro] = useState("");
  const [largura, setLargura] = useState(0);

  useEffect(() => {
    let ativo = true;
    abrirPdf(url)
      .then((doc) => ativo && setDocumento(doc))
      .catch(() => ativo && setErro("Não foi possível mostrar o PDF aqui."));
    return () => {
      ativo = false;
    };
  }, [url]);

  // Desenha na largura real da área (e redesenha se a janela mudar de tamanho).
  useEffect(() => {
    if (!area.current) return;
    const medir = () => setLargura(area.current?.clientWidth ?? 0);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(area.current);
    return () => observador.disconnect();
  }, [documento]);

  if (erro) {
    return (
      <Aviso tipo="info">
        {erro} <a href={url} target="_blank" rel="noreferrer" className="font-semibold underline">Abrir {nome} em outra aba</a>
      </Aviso>
    );
  }
  if (!documento) return <p className="py-10 text-center text-suave" role="status">Abrindo o material…</p>;

  return (
    <div ref={area} className="space-y-3">
      <p className="text-xs text-suave">{documento.numPages} páginas</p>
      {Array.from({ length: documento.numPages }, (_, i) => (
        <Pagina key={i} documento={documento} numero={i + 1} largura={largura} />
      ))}
    </div>
  );
}

/** Mostra o material da aula dentro do site: PDF enviado (PDF.js), Google Drive (preview) ou link de PDF. */
export default function LeitorPdf({ aula }: { aula: { material_arquivo?: string; material_nome?: string; material_url?: string } }) {
  const fonte: FonteMaterial | null = fonteDoMaterial(aula);
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [expandido, setExpandido] = useState(false);

  useEffect(() => {
    setErro("");
    setUrl(null);
    if (!fonte) return;
    if (fonte.tipo === "arquivo") linkDoArquivo(fonte.caminho).then(setUrl).catch((e) => setErro((e as Error).message));
    else setUrl(fonte.tipo === "drive" ? fonte.embed : fonte.url);
    // A fonte só muda quando os campos da aula mudam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aula.material_arquivo, aula.material_url]);

  if (!fonte) return null;
  const abrirFora = fonte.tipo === "drive" ? fonte.original : url;

  return (
    <section className={`rounded-2xl border border-borda bg-superficie p-4 sm:p-5 ${expandido ? "" : ""}`} aria-label="Material da aula">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <FileText className="size-5 text-marca" aria-hidden="true" />
        <h2 className="flex-1 font-serif text-lg font-bold text-marca">Material da aula</h2>
        {fonte.tipo !== "drive" && (
          <button onClick={() => setExpandido(!expandido)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-suave hover:bg-fundo hover:text-texto">
            {expandido ? <><Minimize2 className="size-3.5" /> Reduzir</> : <><Maximize2 className="size-3.5" /> Ampliar</>}
          </button>
        )}
        {abrirFora && (
          <a href={abrirFora} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-destaque hover:bg-destaque-suave">
            <ExternalLink className="size-3.5" /> Abrir em outra aba
          </a>
        )}
      </div>
      {erro && <Aviso>{erro}</Aviso>}
      {url && fonte.tipo === "drive" && (
        <iframe src={url} title="Material da aula" className="aspect-[4/3] w-full rounded-lg border border-borda sm:aspect-video" allow="autoplay" />
      )}
      {url && fonte.tipo !== "drive" && (
        <div className={expandido ? "" : "mx-auto max-w-3xl"}>
          <LeitorDeArquivo url={url} nome={fonte.tipo === "arquivo" ? fonte.nome : "o PDF"} />
        </div>
      )}
    </section>
  );
}
