// Partes comuns das Edge Functions: respostas HTTP, erros, acesso ao Supabase com o login do professor e o
// registro em geracoes_ia. Sem dependências: roda no Deno (Supabase) e no Node (testes locais).

export type LerAmbiente = (nome: string) => string | undefined;
export type Config = { provedor: string; modelo: string; limite_diario: number };
export type Habilidade = "gerar_lista" | "gerar_audio";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "x-duracao, x-restantes, x-modelo",
};

export class ErroHttp extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

/** Lê o token do professor; sem ele, a função nem começa. */
export function tokenDoPedido(req: Request) {
  return (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
}

/** REST do Supabase com o login do próprio professor: as regras de acesso do banco valem aqui também. */
export function clienteSupabase(env: LerAmbiente, token: string, fetchFn: typeof fetch) {
  const url = env("SUPABASE_URL");
  const anon = env("SUPABASE_ANON_KEY");
  if (!url || !anon) throw new ErroHttp(500, "SUPABASE_URL ou SUPABASE_ANON_KEY ausentes no ambiente da função.");
  return async (caminho: string, init: RequestInit = {}) => {
    const resposta = await fetchFn(`${url}${caminho}`, {
      ...init,
      headers: { apikey: anon, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    const corpo = await resposta.text();
    if (!resposta.ok) throw new ErroHttp(resposta.status, `Supabase ${caminho.split("?")[0]} respondeu ${resposta.status}: ${corpo.slice(0, 200)}`);
    return corpo ? JSON.parse(corpo) : null;
  };
}
export type Supabase = ReturnType<typeof clienteSupabase>;

/**
 * Tudo o que a função precisa saber antes de chamar a IA, num vai e volta só (os pedidos saem juntos):
 * se o login vale, se é da equipe, a configuração da habilidade e quantas gerações a pessoa já fez hoje.
 * `extras` são consultas da própria função que podem ir no mesmo lote.
 */
export async function prepararGeracao(
  supabase: Supabase,
  habilidade: Habilidade,
  padrao: Config,
  mensagemSemPermissao: string,
  ...extras: Promise<unknown>[]
): Promise<{ config: Config; usadas: number; extras: unknown[] }> {
  const [usuario, equipe, linhas, usadas, ...resto] = await Promise.allSettled([
    supabase("/auth/v1/user"),
    supabase("/rest/v1/rpc/eh_equipe", { method: "POST", body: "{}" }),
    supabase(`/rest/v1/config_ia?habilidade=eq.${habilidade}&select=provedor,modelo,limite_diario`),
    supabase("/rest/v1/rpc/geracoes_hoje", { method: "POST", body: JSON.stringify({ habilidade_pedida: habilidade }) }),
    ...extras,
  ]);
  if (usuario.status === "rejected") throw new ErroHttp(401, "Sua sessão expirou. Entre de novo.");
  if (equipe.status === "rejected" || equipe.value !== true) throw new ErroHttp(403, mensagemSemPermissao);
  for (const r of [linhas, usadas, ...resto]) if (r.status === "rejected") throw r.reason;
  const config: Config = (linhas as PromiseFulfilledResult<Config[] | null>).value?.[0] ?? padrao;
  return {
    config,
    usadas: (usadas as PromiseFulfilledResult<number>).value,
    extras: resto.map((r) => (r as PromiseFulfilledResult<unknown>).value),
  };
}

/** Anota a geração (certa ou com erro) em geracoes_ia: é o histórico que o admin vê. */
export async function registrarGeracao(
  supabase: Supabase,
  dados: { habilidade: Habilidade; config: Config; pedido: string; ok: boolean; erro: string; inicio: number; tokensEntrada?: number; tokensSaida?: number },
) {
  await supabase("/rest/v1/geracoes_ia", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      habilidade: dados.habilidade, provedor: dados.config.provedor, modelo: dados.config.modelo, pedido: dados.pedido, ok: dados.ok,
      erro: dados.erro.slice(0, 1000), tokens_entrada: dados.tokensEntrada ?? 0, tokens_saida: dados.tokensSaida ?? 0,
      segundos: Math.round((Date.now() - dados.inicio) / 100) / 10,
    }),
  });
}

/** Segundos que o Google pede para esperar antes de tentar de novo (detalhe RetryInfo do erro 429). */
export function esperaSugerida(dados: { error?: { details?: { retryDelay?: string }[] } }): number | undefined {
  const atraso = dados.error?.details?.find((d) => d.retryDelay)?.retryDelay;
  const segundos = atraso ? parseFloat(atraso) : NaN;
  return Number.isFinite(segundos) ? Math.ceil(segundos) + 1 : undefined;
}

export const esperar = (segundos: number) => new Promise((r) => setTimeout(r, segundos * 1000));

/**
 * No Supabase (Deno), publica o servidor. Fora dele (Node, ou os testes, que ligam `semServidor` antes de importar),
 * não faz nada: o arquivo só exporta as funções.
 */
export function servir(atender: (req: Request, env: LerAmbiente) => Promise<Response>) {
  type AmbienteDeno = { serve: (h: (req: Request) => Promise<Response>) => void; env: { get: (n: string) => string | undefined } };
  const global = globalThis as { Deno?: AmbienteDeno; semServidor?: boolean };
  const deno = global.Deno;
  if (deno && !global.semServidor) deno.serve((req) => atender(req, (nome) => deno.env.get(nome)));
}
