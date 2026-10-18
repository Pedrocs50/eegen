import { useEffect, useState } from "react";
import { AlertTriangle, AudioLines, CheckCircle2, RefreshCw } from "lucide-react";
import { gerarAudio } from "../lib/audio";
import { assinaturaAudio, type Estimulo } from "../lib/exercicios";
import { MAX_FALANTES, VOZES, completarVozes, falantesDoRoteiro } from "../lib/vozes";
import { Aviso, Botao } from "./ui";

const CONTROLE =
  "w-full rounded-xl border border-borda bg-superficie px-3 py-2.5 text-sm text-texto placeholder:text-suave/70 focus:border-destaque focus:outline-none focus:ring-4 focus:ring-destaque-suave";

type Props = { estimulo: Estimulo; aoMudar: (e: Estimulo) => void };

/** Seção de listening no editor: roteiro, voz de cada falante, quando mostrar a transcrição e o botão de gerar. */
export default function EditorAudio({ estimulo, aoMudar }: Props) {
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const roteiro = estimulo.roteiro ?? "";
  const falantes = falantesDoRoteiro(roteiro);
  const vozes = estimulo.vozes ?? {};
  const atualizado = !!estimulo.audio_url && estimulo.audio_assinatura === assinaturaAudio(roteiro, vozes);

  // Falante novo no roteiro ganha uma voz automaticamente (pelo gênero sugerido, se houver).
  useEffect(() => {
    if (falantes.some((f) => !vozes[f])) {
      aoMudar({ ...estimulo, vozes: completarVozes(falantes, vozes, estimulo.generos) });
    }
    // Só reage à lista de falantes; aoMudar e o resto do estímulo mudam a cada tecla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [falantes.join("|")]);

  async function gerar() {
    setErro("");
    setAviso("");
    setGerando(true);
    try {
      const vozesUsadas = Object.fromEntries(falantes.map((f) => [f, vozes[f]]));
      const r = await gerarAudio(roteiro, vozesUsadas);
      aoMudar({ ...estimulo, vozes: vozesUsadas, audio_url: r.url, audio_assinatura: assinaturaAudio(roteiro, vozesUsadas), duracao: Math.round(r.segundos) });
      setAviso(r.reaproveitado ? "Esse áudio já existia e foi reaproveitado (não gastou a cota)." : `Áudio gerado: ${Math.round(r.segundos)} segundos.`);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-texto">
          Roteiro <span className="font-normal text-suave">· uma fala por linha no formato NOME: fala · até {MAX_FALANTES} falantes</span>
        </span>
        <textarea
          rows={7}
          value={roteiro}
          onChange={(e) => aoMudar({ ...estimulo, roteiro: e.target.value })}
          placeholder={"MIA: Hi! Are you new in the office?\nSAM: Yes, I started today. I'm in the marketing team."}
          className={`${CONTROLE} font-mono text-xs leading-relaxed`}
        />
      </label>

      {falantes.length > MAX_FALANTES && (
        <Aviso>Este roteiro tem {falantes.length} falantes ({falantes.join(", ")}). Cada áudio aceita no máximo {MAX_FALANTES}: divida a conversa em duas seções.</Aviso>
      )}

      {falantes.length > 0 && falantes.length <= MAX_FALANTES && (
        <div className="grid gap-3 sm:grid-cols-2">
          {falantes.map((f) => (
            <label key={f} className="block">
              <span className="mb-1 block text-xs font-semibold">Voz de {f}</span>
              <select value={vozes[f] ?? ""} onChange={(e) => aoMudar({ ...estimulo, vozes: { ...vozes, [f]: e.target.value } })} className={CONTROLE}>
                <optgroup label="Femininas">
                  {VOZES.filter((v) => v.genero === "feminina").map((v) => <option key={v.nome} value={v.nome}>{v.nome} · {v.estilo}</option>)}
                </optgroup>
                <optgroup label="Masculinas">
                  {VOZES.filter((v) => v.genero === "masculina").map((v) => <option key={v.nome} value={v.nome}>{v.nome} · {v.estilo}</option>)}
                </optgroup>
              </select>
            </label>
          ))}
        </div>
      )}

      <label className="block sm:w-80">
        <span className="mb-1 block text-xs font-semibold">Transcrição para o aluno</span>
        <select value={estimulo.transcricao ?? "depois"} onChange={(e) => aoMudar({ ...estimulo, transcricao: e.target.value as Estimulo["transcricao"] })} className={CONTROLE}>
          <option value="depois">Mostrar depois de enviar as respostas</option>
          <option value="antes">Pode ver a qualquer momento</option>
          <option value="nunca">Não mostrar</option>
        </select>
      </label>

      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-fundo p-3">
        <Botao onClick={gerar} carregando={gerando} disabled={!roteiro.trim() || falantes.length === 0 || falantes.length > MAX_FALANTES}>
          {estimulo.audio_url ? <><RefreshCw className="size-4" /> Gerar de novo</> : <><AudioLines className="size-4" /> Gerar áudio</>}
        </Botao>
        {gerando && <span className="text-sm text-suave">Gerando a voz… costuma levar de 5 a 20 segundos.</span>}
        {!gerando && estimulo.audio_url && (atualizado ? (
          <span className="inline-flex items-center gap-1 text-sm text-sucesso"><CheckCircle2 className="size-4" /> Áudio em dia{estimulo.duracao ? ` · ${estimulo.duracao}s` : ""}</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-sm text-coral"><AlertTriangle className="size-4" /> O roteiro ou as vozes mudaram: gere de novo</span>
        ))}
      </div>

      {estimulo.audio_url && <audio controls preload="none" src={estimulo.audio_url} className="w-full" />}
      {erro && <Aviso>{erro}</Aviso>}
      {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}
    </div>
  );
}
