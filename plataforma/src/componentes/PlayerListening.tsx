import { useRef, useState } from "react";
import { FileText, Headphones } from "lucide-react";
import type { Estimulo } from "../lib/exercicios";

const VELOCIDADES = [0.75, 1, 1.25];

/** Player do listening para o aluno: velocidade ajustável e transcrição conforme a escolha do professor. */
export default function PlayerListening({ estimulo, enviado }: { estimulo: Estimulo; enviado: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [velocidade, setVelocidade] = useState(1);
  const [verTranscricao, setVerTranscricao] = useState(false);
  const quando = estimulo.transcricao ?? "depois";
  const podeVer = quando === "antes" || (quando === "depois" && enviado);

  function mudarVelocidade(v: number) {
    setVelocidade(v);
    if (audio.current) audio.current.playbackRate = v;
  }

  if (!estimulo.audio_url) {
    return <p className="mt-4 rounded-xl bg-fundo p-4 text-sm text-suave">O áudio desta seção ainda não foi gerado.</p>;
  }

  return (
    <div className="mt-4 rounded-2xl border-l-4 border-marca bg-creme p-4 sm:p-5">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-marca">
        <Headphones className="size-5" aria-hidden="true" /> Ouça o áudio{estimulo.duracao ? ` (${estimulo.duracao}s)` : ""}
      </p>
      <audio ref={audio} controls preload="metadata" src={estimulo.audio_url} className="w-full" onPlay={(e) => (e.currentTarget.playbackRate = velocidade)} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-suave">Velocidade:</span>
        {VELOCIDADES.map((v) => (
          <button
            key={v}
            onClick={() => mudarVelocidade(v)}
            aria-pressed={velocidade === v}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${velocidade === v ? "bg-marca text-sobre-marca" : "border border-borda bg-superficie text-suave hover:text-texto"}`}
          >
            {v}×
          </button>
        ))}
        {podeVer && estimulo.roteiro && (
          <button onClick={() => setVerTranscricao(!verTranscricao)} aria-expanded={verTranscricao} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-destaque hover:underline">
            <FileText className="size-3.5" /> {verTranscricao ? "Esconder transcrição" : "Ver transcrição"}
          </button>
        )}
        {quando === "depois" && !enviado && <span className="ml-auto text-xs text-suave">A transcrição aparece depois que você enviar.</span>}
      </div>
      {podeVer && verTranscricao && (
        <div className="mt-3 space-y-1 rounded-xl bg-superficie p-4 text-sm">
          {(estimulo.roteiro ?? "").split(/\r?\n/).filter((l) => l.trim()).map((linha, i) => {
            const separador = linha.indexOf(":");
            return separador > 0 ? (
              <p key={i}><span className="font-semibold text-marca">{linha.slice(0, separador)}:</span>{linha.slice(separador + 1)}</p>
            ) : <p key={i}>{linha}</p>;
          })}
        </div>
      )}
    </div>
  );
}
