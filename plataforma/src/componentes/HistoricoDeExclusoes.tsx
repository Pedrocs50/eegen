import { Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useConsulta } from "../lib/dados";
import { Aviso, TextoCarregando } from "./ui";

type Registro = { id: string; tabela: string; linha: Record<string, unknown>; por: string | null; via: string; em: string };

const ROTULOS: Record<string, string> = { cursos: "Curso", turmas: "Turma", aulas: "Aula", matriculas: "Matrícula" };

/** O que foi apagado, a partir de uma linha guardada no registro. */
function descricao(r: Registro) {
  const l = r.linha;
  if (r.tabela === "aulas") return `Aula ${l.numero ?? ""} · ${l.titulo ?? ""}`;
  if (r.tabela === "matriculas") return `Aluno ${String(l.aluno_id ?? "").slice(0, 8)}… na turma ${String(l.turma_id ?? "").slice(0, 8)}…`;
  return String(l.titulo ?? l.nome ?? "(sem nome)");
}

const formatoData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/**
 * Registro das exclusões de cursos, turmas, aulas e matrículas (só admin). Serve para descobrir por que algo sumiu:
 * quem apagou, quando e por onde (o site ou o SQL Editor do Supabase).
 */
export default function HistoricoDeExclusoes() {
  const { dados, erro, carregando } = useConsulta<{ registros: Registro[]; nomes: Record<string, string> }>(async () => {
    const registros = await supabase.from("registro_exclusoes").select("id, tabela, linha, por, via, em").order("em", { ascending: false }).limit(100);
    if (registros.error) return { data: null, error: registros.error };
    const lista = registros.data as Registro[];
    const ids = [...new Set(lista.map((r) => r.por).filter((x): x is string => !!x))];
    const nomes: Record<string, string> = {};
    if (ids.length) {
      const { data } = await supabase.from("perfis").select("id, nome, email").in("id", ids);
      for (const p of (data ?? []) as { id: string; nome: string; email: string }[]) nomes[p.id] = p.nome || p.email;
    }
    return { data: { registros: lista, nomes }, error: null };
  });

  return (
    <section className="mt-8 rounded-2xl border border-borda bg-superficie p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-marca"><Trash2 className="size-5" /> Exclusões recentes</h2>
      <p className="mb-4 text-sm text-suave">Tudo o que foi apagado de cursos, turmas, aulas e matrículas, com quem pediu e por onde. Se algo sumir, comece por aqui.</p>
      {erro && <Aviso>{erro}</Aviso>}
      {carregando && !dados && <TextoCarregando />}
      {dados && dados.registros.length === 0 && <p className="text-sm text-suave">Nenhuma exclusão registrada até agora.</p>}
      {dados && dados.registros.length > 0 && (
        <div className="-mx-5 overflow-x-auto sm:-mx-6">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-borda text-left text-xs text-suave uppercase">
                <th className="px-5 py-2 font-semibold sm:px-6">Quando</th>
                <th className="px-3 py-2 font-semibold">O quê</th>
                <th className="px-3 py-2 font-semibold">Quem</th>
                <th className="px-3 py-2 font-semibold">Por onde</th>
              </tr>
            </thead>
            <tbody>
              {dados.registros.map((r) => (
                <tr key={r.id} className="border-b border-borda last:border-0">
                  <td className="px-5 py-2.5 whitespace-nowrap text-suave sm:px-6">{formatoData.format(new Date(r.em))}</td>
                  <td className="px-3 py-2.5"><span className="mr-2 rounded-full bg-creme px-2 py-0.5 text-xs font-semibold text-suave">{ROTULOS[r.tabela] ?? r.tabela}</span>{descricao(r)}</td>
                  <td className="px-3 py-2.5">{r.por ? dados.nomes[r.por] ?? r.por.slice(0, 8) : <span className="text-suave">sem usuário (SQL Editor)</span>}</td>
                  <td className="px-3 py-2.5 text-suave">{r.via}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
