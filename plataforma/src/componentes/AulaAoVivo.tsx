import { useEffect, useState } from "react";
import { CalendarClock, Megaphone, Radio, Video } from "lucide-react";
import { useConsulta } from "../lib/dados";
import { avisoValido, buscarEncontros, duracaoTexto, quandoE, resumoHorarios, situacaoDaAula, type Encontros } from "../lib/aoVivo";

/**
 * Cartão "Aula ao vivo" da Minha turma: o link fixo da reunião, sempre à mão.
 * Destaque forte durante a aula e nos 15 minutos antes; no resto do tempo, mostra quando é a próxima.
 */
export default function AulaAoVivo({ idTurma }: { idTurma: string }) {
  const { dados } = useConsulta<Encontros | null>(() => buscarEncontros(idTurma), [idTurma]);
  // Recalcula a situação a cada 30 s (a aula pode começar com a página aberta).
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const relogio = setInterval(() => setAgora(new Date()), 30_000);
    return () => clearInterval(relogio);
  }, []);

  if (!dados || !dados.link) return null;
  const situacao = situacaoDaAula(dados.horarios, agora);
  const aviso = avisoValido(dados, agora) ? dados.aviso : "";
  const destaque = situacao.tipo === "agora" || situacao.tipo === "em_breve";

  const botao = (
    <a
      href={dados.link}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl px-5 font-semibold transition sm:w-auto ${
        situacao.tipo === "agora"
          ? "bg-white text-sucesso hover:bg-white/90"
          : destaque
            ? "bg-white text-marinho-800 hover:bg-white/90"
            : "border border-borda bg-superficie text-marca hover:bg-fundo"
      }`}
    >
      <Video className="size-5" /> Entrar na aula
    </a>
  );

  return (
    <section
      aria-label="Aula ao vivo"
      className={`rounded-2xl p-5 sm:p-6 ${
        situacao.tipo === "agora" ? "bg-sucesso text-white" : destaque ? "bg-marinho-800 text-white" : "border border-borda bg-superficie"
      }`}
    >
      <div className="flex flex-wrap items-center gap-4">
        <span className={`hidden size-12 shrink-0 place-items-center rounded-xl sm:grid ${destaque ? "bg-white/15" : "bg-destaque-suave text-marca"}`}>
          {situacao.tipo === "agora" ? <Radio className="size-6 animate-pulse" /> : <CalendarClock className="size-6" />}
        </span>
        <div className="min-w-0 flex-1 basis-56">
          <p className={`text-[11px] font-bold tracking-[0.12em] uppercase ${destaque ? "text-white/80" : "text-destaque"}`}>Aula ao vivo</p>
          <p className={`font-serif text-xl font-bold ${destaque ? "text-white" : "text-marca"}`}>
            {situacao.tipo === "agora" && "Acontecendo agora"}
            {situacao.tipo === "em_breve" && `Começa em ${situacao.comecaEm <= 1 ? "1 minuto" : `${situacao.comecaEm} minutos`}`}
            {situacao.tipo === "proxima" && `Próxima aula: ${quandoE(situacao, agora)}`}
            {situacao.tipo === "sem_horario" && "Link da aula"}
          </p>
          <p className={`text-sm ${destaque ? "text-white/80" : "text-suave"}`}>
            {situacao.tipo === "agora"
              ? `Termina em ${duracaoTexto(situacao.terminaEm)}. Clique para entrar.`
              : dados.horarios.length
                ? `${resumoHorarios(dados.horarios).join(" · ")} (horário de Brasília)`
                : "A professora ainda não colocou os horários."}
          </p>
        </div>
        {botao}
      </div>
      {aviso && (
        <p className={`mt-4 flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${destaque ? "bg-white/15 text-white" : "bg-coral-suave text-texto"}`}>
          <Megaphone className="mt-0.5 size-4 shrink-0" /> <span><strong>Aviso da professora:</strong> {aviso}</span>
        </p>
      )}
    </section>
  );
}
