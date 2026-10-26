import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { supabase, traduzirErro } from "../lib/supabase";
import { nomeNivel, useConsulta, type Idioma } from "../lib/dados";
import { CAMPOS_MATERIAL, adicionarABiblioteca, casarPorTitulo, erroDeArquivo, ordemNatural, type Material } from "../lib/biblioteca";
import { Aviso, Botao } from "./ui";

type AulaSemPdf = { id: string; numero: number; titulo: string; material_arquivo: string; material_url: string };

/**
 * Coloca os PDFs nas aulas que já existem e ainda estão sem material, todas de uma vez: o site sugere o PDF de cada
 * aula pelo nome (da biblioteca ou enviado aqui mesmo), a professora confere e salva.
 */
export default function PdfsDasAulas({ curso, aulas, aoSalvar }: {
  curso: { idioma: Idioma; nivel: number };
  aulas: AulaSemPdf[];
  aoSalvar: () => void;
}) {
  const { dados: materiais, recarregar } = useConsulta<Material[]>(() => supabase.from("materiais").select(CAMPOS_MATERIAL).eq("idioma", curso.idioma), [curso.idioma]);
  // Escolhas que a professora mudou; o resto segue a sugestão pelo nome ("" = deixar sem PDF).
  const [escolhas, setEscolhas] = useState<Map<string, string>>(new Map());
  const [enviando, setEnviando] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const entrada = useRef<HTMLInputElement>(null);

  const semPdf = aulas.filter((a) => !a.material_arquivo && !a.material_url).sort((a, b) => a.numero - b.numero);
  if (semPdf.length === 0 || !materiais) return null;

  // PDFs que o curso já usa ficam fora das sugestões (cada aula tem o seu).
  const usados = new Set(aulas.map((a) => a.material_arquivo).filter(Boolean));
  const livres = materiais.filter((m) => !usados.has(m.arquivo));
  const doNivel = (m: Material) => m.nivel === curso.nivel || m.nivel === null;
  const sugestoes = casarPorTitulo(semPdf, [...livres.filter(doNivel), ...livres.filter((m) => !doNivel(m))], { unico: true });
  const escolhido = (aula: AulaSemPdf) => escolhas.get(aula.id) ?? sugestoes.get(aula.id)?.arquivo ?? "";
  const porArquivo = new Map(materiais.map((m) => [m.arquivo, m]));
  const prontas = semPdf.filter((a) => escolhido(a));
  const repetidos = new Set(prontas.map(escolhido).filter((arq, i, todos) => todos.indexOf(arq) !== i));
  const opcoes = [...livres].sort((a, b) => Number(doNivel(b)) - Number(doNivel(a)) || ordemNatural(a.titulo, b.titulo));

  async function enviar(arquivos: File[]) {
    setErro("");
    const problemas: string[] = [];
    for (const [i, arquivo] of arquivos.entries()) {
      const problema = erroDeArquivo(arquivo);
      if (problema) {
        problemas.push(`${arquivo.name}: ${problema}`);
        continue;
      }
      setEnviando(`Enviando ${i + 1} de ${arquivos.length}: ${arquivo.name}`);
      try {
        await adicionarABiblioteca(arquivo, { idioma: curso.idioma, nivel: curso.nivel });
      } catch (e) {
        problemas.push((e as Error).message);
      }
    }
    setEnviando("");
    if (problemas.length) setErro(problemas.join(" "));
    await recarregar();
  }

  async function salvar() {
    setErro("");
    setSalvando(true);
    const respostas = await Promise.all(
      prontas.map((aula) => {
        const m = porArquivo.get(escolhido(aula))!;
        return supabase.from("aulas").update({ material_arquivo: m.arquivo, material_nome: m.nome_original || `${m.titulo}.pdf`, material_url: "" }).eq("id", aula.id);
      }),
    );
    setSalvando(false);
    const falha = respostas.find((r) => r.error);
    if (falha?.error) return setErro(traduzirErro(falha.error.message));
    setEscolhas(new Map());
    aoSalvar();
  }

  return (
    <details open className="mb-6 rounded-2xl border border-coral/40 bg-coral-suave">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-superficie text-marca"><FileUp className="size-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-marca">Colocar os PDFs nas aulas</span>
          <span className="block text-sm text-suave">{semPdf.length} {semPdf.length === 1 ? "aula está" : "aulas estão"} sem material. O site sugere o PDF de cada uma pelo nome; confira e salve tudo de uma vez.</span>
        </span>
      </summary>
      <div className="border-t border-coral/30 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Botao variante="secundario" type="button" onClick={() => entrada.current?.click()} carregando={!!enviando}>
            <FileUp className="size-4" /> Enviar PDFs do computador
          </Botao>
          <input ref={entrada} type="file" accept="application/pdf,.pdf" multiple className="sr-only" onChange={(e) => { enviar([...(e.target.files ?? [])]); e.target.value = ""; }} />
          <span className="text-xs text-suave">{enviando || `Pode escolher vários. Vão para a biblioteca como ${nomeNivel(curso.idioma, curso.nivel)} e já aparecem nas sugestões.`}</span>
        </div>

        <ol className="mb-4 space-y-2">
          {semPdf.map((aula) => {
            const valor = escolhido(aula);
            const sugerido = !escolhas.has(aula.id) && !!valor;
            return (
              <li key={aula.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-superficie px-3 py-2 sm:flex-nowrap">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-marinho-800 text-xs font-bold text-white">{aula.numero}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{aula.titulo}</span>
                <label className="w-full sm:w-80">
                  <span className="sr-only">PDF da aula {aula.numero}</span>
                  <select
                    value={valor}
                    onChange={(e) => setEscolhas(new Map(escolhas).set(aula.id, e.target.value))}
                    className={`h-10 w-full rounded-lg border bg-superficie px-2 text-sm ${repetidos.has(valor) ? "border-erro" : "border-borda"}`}
                  >
                    <option value="">— sem PDF por enquanto —</option>
                    {opcoes.map((m) => (
                      <option key={m.id} value={m.arquivo}>
                        {m.titulo}{m.nivel && m.nivel !== curso.nivel ? ` (${nomeNivel(curso.idioma, m.nivel)})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {sugerido && <span className="shrink-0 text-xs text-sucesso">sugerido</span>}
              </li>
            );
          })}
        </ol>

        {repetidos.size > 0 && <p className="mb-3 text-sm text-erro">O mesmo PDF está em mais de uma aula (marcado em vermelho). Pode salvar assim, se for de propósito.</p>}
        {erro && <div className="mb-3"><Aviso>{erro}</Aviso></div>}
        <Botao onClick={salvar} carregando={salvando} disabled={prontas.length === 0}>
          {prontas.length === 0 ? "Escolha o PDF de pelo menos uma aula" : `Salvar o PDF de ${prontas.length} ${prontas.length === 1 ? "aula" : "aulas"}`}
        </Botao>
      </div>
    </details>
  );
}
