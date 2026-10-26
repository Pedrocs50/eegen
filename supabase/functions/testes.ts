// Testes das Edge Functions com o Supabase e o Gemini simulados (nada sai para a internet).
// Rodar na pasta supabase/functions:  deno test testes.ts
// O GitHub Actions roda antes de publicar (.github/workflows/funcoes.yml).

// As funções publicam o servidor ao serem carregadas; aqui só queremos chamá-las.
(globalThis as { semServidor?: boolean }).semServidor = true;
const { atender: assistente } = await import("./assistente/index.ts");
const { atender: audio } = await import("./audio/index.ts");

/** Compara pelo conteúdo (JSON) e mostra o que veio quando falha. */
function semelhante(veio: unknown, esperado: unknown) {
  if (JSON.stringify(veio) !== JSON.stringify(esperado)) throw new Error(`esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(veio)}`);
}

const env = (n: string) => ({ SUPABASE_URL: "https://banco.teste", SUPABASE_ANON_KEY: "anon", GEMINI_API_KEY: "chave" })[n as "SUPABASE_URL"];

const LISTA = {
  titulo: "Simple past", tema: "Past", descricao: "Vamos lá?", idioma: "ingles", nivel: 2,
  secoes: [{ tipo: "questoes", titulo: "S1", questoes: [{ formato: "verdadeiro_falso", enunciado: "x", resposta: true, explicacao: "y" }] }],
};

type Simulacao = { equipe?: boolean; usadas?: number; gemini?: (modelo: string, corpo: Record<string, unknown>, sinal?: AbortSignal | null) => Response | Promise<Response> };
type Chamada = { url: string; corpo: Record<string, unknown> | null };

/** fetch falso: responde como o Supabase e o Gemini e guarda o que foi pedido. */
function simular({ equipe = true, usadas = 0, gemini }: Simulacao) {
  const chamadas: Chamada[] = [];
  const fetchFalso = async (entrada: string | URL | Request, init: RequestInit = {}) => {
    const url = String(entrada);
    const corpo = typeof init.body === "string" && init.body ? JSON.parse(init.body) : null;
    chamadas.push({ url, corpo });
    const ok = (dados: unknown) => new Response(JSON.stringify(dados), { status: 200 });
    if (url.endsWith("/auth/v1/user")) return ok({ id: "prof" });
    if (url.includes("/rpc/eh_equipe")) return ok(equipe);
    if (url.includes("/rest/v1/config_ia")) return ok([]);
    if (url.includes("/rpc/geracoes_hoje")) return ok(usadas);
    if (url.includes("/rest/v1/listas")) return ok([]);
    if (url.includes("/rest/v1/geracoes_ia")) return new Response("", { status: 201 });
    const modelo = /models\/([^:]+):/.exec(url)?.[1];
    if (modelo && gemini) return gemini(modelo, corpo ?? {}, init.signal);
    return new Response("{}", { status: 404 });
  };
  return { chamadas, fetchFalso: fetchFalso as typeof fetch };
}

const respostaGemini = (texto: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: texto }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 } }), { status: 200 });
const pedidoAssistente = () =>
  new Request("https://f.teste/assistente", {
    method: "POST",
    headers: { Authorization: "Bearer token" },
    body: JSON.stringify({ idioma: "ingles", nivel: 2, mensagens: [{ papel: "professor", texto: "10 questões de simple past" }] }),
  });

Deno.test("assistente: devolve a lista, pede pouco 'pensamento' e registra a geração", async () => {
  const { chamadas, fetchFalso } = simular({ gemini: () => respostaGemini(JSON.stringify({ mensagem: "Pronto!", lista: LISTA })) });
  const resposta = await assistente(pedidoAssistente(), env, fetchFalso);
  const dados = await resposta.json();
  semelhante(resposta.status, 200);
  semelhante(dados.lista.titulo, "Simple past");
  semelhante(dados.restantes, 29);
  const gemini = chamadas.find((c) => c.url.includes("generativelanguage"))!;
  semelhante((gemini.corpo!.generationConfig as { thinkingConfig?: unknown }).thinkingConfig, { thinkingLevel: "low" });
  semelhante(chamadas.filter((c) => c.url.includes("/geracoes_ia")).length, 1);
});

Deno.test("assistente: modelo principal sobrecarregado vai direto para o de reserva, sem esperar", async () => {
  const modelos: string[] = [];
  const { fetchFalso } = simular({
    gemini: (modelo) => {
      modelos.push(modelo);
      return modelo === "gemini-flash-latest" ? new Response('{"error":{"code":503}}', { status: 503 }) : respostaGemini(JSON.stringify({ mensagem: "ok", lista: LISTA }));
    },
  });
  const inicio = Date.now();
  const resposta = await assistente(pedidoAssistente(), env, fetchFalso);
  semelhante(resposta.status, 200);
  semelhante((await resposta.json()).modelo, "gemini-3.5-flash-lite");
  semelhante(modelos, ["gemini-flash-latest", "gemini-3.5-flash-lite"]);
  if (Date.now() - inicio > 1000) throw new Error("esperou à toa antes de usar o modelo de reserva");
});

Deno.test("assistente: modelo principal travado perde a vez para o de reserva quando estoura o prazo", async () => {
  const modelos: string[] = [];
  const { chamadas, fetchFalso } = simular({
    gemini: (modelo, _corpo, sinal) => {
      modelos.push(modelo);
      if (modelo !== "gemini-flash-latest") return respostaGemini(JSON.stringify({ mensagem: "ok", lista: LISTA }));
      // Nunca responde: só termina quando a função desiste (como o Gemini travado de 26/10/2026).
      return new Promise((_, rejeitar) => sinal?.addEventListener("abort", () => rejeitar(sinal.reason)));
    },
  });
  const envRapido = (n: string) => (n === "LIMITE_PRINCIPAL_S" ? "0.2" : env(n));
  const inicio = Date.now();
  const resposta = await assistente(pedidoAssistente(), envRapido, fetchFalso);
  semelhante(resposta.status, 200);
  semelhante((await resposta.json()).modelo, "gemini-3.5-flash-lite");
  semelhante(modelos, ["gemini-flash-latest", "gemini-3.5-flash-lite"]);
  if (Date.now() - inicio > 2000) throw new Error("não respeitou o prazo do modelo principal");
  semelhante(chamadas.filter((c) => c.url.includes("/geracoes_ia")).length, 1);
});

Deno.test("assistente: os dois modelos travados viram um erro claro (e registrado), antes do corte do Supabase", async () => {
  const { chamadas, fetchFalso } = simular({
    gemini: (_modelo, _corpo, sinal) => new Promise((_, rejeitar) => sinal?.addEventListener("abort", () => rejeitar(sinal.reason))),
  });
  const envRapido = (n: string) => (n.startsWith("LIMITE_") ? "0.2" : env(n));
  const resposta = await assistente(pedidoAssistente(), envRapido, fetchFalso);
  semelhante(resposta.status, 504);
  semelhante((await resposta.json()).erro, "O assistente não conseguiu gerar a resposta agora. Tente de novo.");
  semelhante(chamadas.filter((c) => c.url.includes("/geracoes_ia")).length, 1);
});

Deno.test("assistente: JSON torto ganha uma segunda chance", async () => {
  let vez = 0;
  const { fetchFalso } = simular({ gemini: () => respostaGemini(vez++ === 0 ? "desculpe, não consegui" : JSON.stringify({ mensagem: "ok", lista: LISTA })) });
  const resposta = await assistente(pedidoAssistente(), env, fetchFalso);
  semelhante(resposta.status, 200);
  semelhante(vez, 2);
});

Deno.test("assistente: quem não é da equipe recebe 403 e a IA não é chamada", async () => {
  const { chamadas, fetchFalso } = simular({ equipe: false, gemini: () => respostaGemini("{}") });
  const resposta = await assistente(pedidoAssistente(), env, fetchFalso);
  semelhante(resposta.status, 403);
  semelhante(chamadas.some((c) => c.url.includes("generativelanguage")), false);
});

Deno.test("assistente: cota do dia esgotada avisa e não chama a IA", async () => {
  const { chamadas, fetchFalso } = simular({ usadas: 30, gemini: () => respostaGemini("{}") });
  const resposta = await assistente(pedidoAssistente(), env, fetchFalso);
  semelhante(resposta.status, 429);
  semelhante((await resposta.json()).erro.startsWith("Você já usou"), true);
  semelhante(chamadas.some((c) => c.url.includes("generativelanguage")), false);
});

// Por último: depois dele, a função para de mandar o ajuste de "pensamento" (vale para o processo todo).
Deno.test("assistente: modelo que não aceita o ajuste de 'pensamento' recebe o pedido sem ele", async () => {
  const corpos: Record<string, unknown>[] = [];
  const { fetchFalso } = simular({
    gemini: (_modelo, corpo) => {
      corpos.push(corpo);
      const comAjuste = !!(corpo.generationConfig as { thinkingConfig?: unknown }).thinkingConfig;
      return comAjuste ? new Response('{"error":{"message":"thinking_level is not supported"}}', { status: 400 }) : respostaGemini(JSON.stringify({ mensagem: "ok", lista: LISTA }));
    },
  });
  const resposta = await assistente(pedidoAssistente(), env, fetchFalso);
  semelhante(resposta.status, 200);
  semelhante(corpos.length, 2);
});

Deno.test("áudio: devolve o WAV com a duração", async () => {
  const pcm = btoa(String.fromCharCode(...new Uint8Array(48000)));
  const { fetchFalso } = simular({
    gemini: () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/L16;rate=24000", data: pcm } }] } }] }), { status: 200 }),
  });
  const pedido = new Request("https://f.teste/audio", {
    method: "POST",
    headers: { Authorization: "Bearer token" },
    body: JSON.stringify({ roteiro: "MIA: Hello!\nSAM: Hi, Mia.", vozes: { MIA: "Kore", SAM: "Puck" } }),
  });
  const resposta = await audio(pedido, env, fetchFalso);
  semelhante(resposta.status, 200);
  semelhante(resposta.headers.get("x-duracao"), "1.6");
  semelhante((await resposta.arrayBuffer()).byteLength, 44 + 48000 + 0.6 * 24000 * 2);
});

Deno.test("áudio: roteiro com 3 falantes é recusado antes de gastar cota", async () => {
  const { chamadas, fetchFalso } = simular({});
  const pedido = new Request("https://f.teste/audio", {
    method: "POST",
    headers: { Authorization: "Bearer token" },
    body: JSON.stringify({ roteiro: "A: oi\nB: oi\nC: oi", vozes: { A: "Kore", B: "Puck", C: "Leda" } }),
  });
  const resposta = await audio(pedido, env, fetchFalso);
  semelhante(resposta.status, 400);
  semelhante(chamadas.some((c) => c.url.includes("generativelanguage")), false);
});
