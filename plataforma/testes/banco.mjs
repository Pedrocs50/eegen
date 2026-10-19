// Testes do banco: roda todas as migrações num Postgres local (PGlite) com o "auth" e o "storage" do Supabase
// simulados, e confere as regras de acesso e a correção das listas.
//
// Uso (na pasta plataforma):  npm run test:banco
// Sai com código 1 se alguma verificação falhar (o GitHub Actions usa isso).
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PASTA_MIGRACOES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../supabase/migrations");
const ADMIN = "00000000-0000-0000-0000-00000000000a";
const PROFESSOR = "00000000-0000-0000-0000-0000000000c1";
const ALUNO = "00000000-0000-0000-0000-0000000000b1";
const OUTRO_ALUNO = "00000000-0000-0000-0000-0000000000b2";

const db = new PGlite();
let falhas = 0;

function conferir(condicao, descricao) {
  console.log(`${condicao ? "  ✓" : "  ✗"} ${descricao}`);
  if (!condicao) falhas += 1;
}

/** Roda o SQL como se fosse o usuário `uid` logado pela API (papel "authenticated"). */
async function como(uid, sql, parametros) {
  await db.exec(`set role authenticated; select set_config('teste.uid', '${uid}', false);`);
  try {
    return await db.query(sql, parametros);
  } finally {
    await db.exec("reset role; select set_config('teste.uid', '', false);");
  }
}

async function falhaComo(uid, sql, parametros) {
  try {
    await como(uid, sql, parametros);
    return false;
  } catch {
    return true;
  }
}

/** Tenta a alteração e diz se ela foi barrada: com erro, ou ignorada pelas regras de acesso (0 linhas). */
async function barrado(uid, sql, conferirDepois) {
  if (await falhaComo(uid, sql)) return true;
  return conferirDepois();
}

async function numero(uid, sql, parametros) {
  const { rows } = await como(uid, sql, parametros);
  return Number(Object.values(rows[0])[0]);
}

// ----------------------------------------------------------------------------- ambiente
await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('teste.uid', true), '')::uuid $$;
  grant usage on schema auth to authenticated;
  grant execute on function auth.uid() to authenticated;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
`);

console.log("Migrações");
for (const arquivo of fs.readdirSync(PASTA_MIGRACOES).filter((a) => a.endsWith(".sql")).sort()) {
  await db.exec(fs.readFileSync(path.join(PASTA_MIGRACOES, arquivo), "utf8"));
  console.log(`  ✓ ${arquivo}`);
}

await db.exec(`
  insert into auth.users (id, email, raw_user_meta_data) values
    ('${ADMIN}', 'admin@teste', '{"nome":"Admin"}'),
    ('${PROFESSOR}', 'prof@teste', '{"nome":"Professora"}'),
    ('${ALUNO}', 'aluno@teste', '{"nome":"Aluno"}'),
    ('${OUTRO_ALUNO}', 'outro@teste', '{"nome":"Outro aluno"}');
  update public.perfis set papel = 'admin' where id = '${ADMIN}';
  update public.perfis set papel = 'professor' where id = '${PROFESSOR}';
`);

// ----------------------------------------------------------------------------- perfis e papéis
console.log("Perfis e papéis");
conferir((await numero(ALUNO, "select count(*) from public.perfis")) === 1, "aluno só vê o próprio perfil");
conferir((await numero(ADMIN, "select count(*) from public.perfis")) === 4, "admin vê todos os perfis");
conferir(await falhaComo(ALUNO, `update public.perfis set papel = 'admin' where id = '${ALUNO}'`), "aluno não se promove");
conferir(await falhaComo(ADMIN, `update public.perfis set papel = 'aluno' where id = '${ADMIN}'`), "admin não muda o próprio papel");

// ----------------------------------------------------------------------------- listas e correção
console.log("Listas e correção");
const lista = {
  titulo: "Teste", idioma: "espanhol", nivel: 1, status: "publicada",
  secoes: [{
    id: "11111111-1111-1111-1111-111111111111", titulo: "S1", tipo_estimulo: "nenhum", estimulo: {},
    questoes: [
      { id: "a0000000-0000-0000-0000-000000000001", formato: "multipla_escolha", enunciado: "MC", conteudo: { opcoes: ["x", "y", "z"] }, gabarito: { correta: 1 }, explicacao: "porque y" },
      { id: "a0000000-0000-0000-0000-000000000002", formato: "verdadeiro_falso", enunciado: "VF", gabarito: { valor: false } },
      { id: "a0000000-0000-0000-0000-000000000003", formato: "lacuna", enunciado: "___ coche, ___ casa", gabarito: { lacunas: [["Éste", "Este"], ["esa"]] } },
      { id: "a0000000-0000-0000-0000-000000000004", formato: "lacuna_opcoes", enunciado: "Ana ___ Isabel", conteudo: { opcoes: [["y", "e"]] }, gabarito: { lacunas: [1] } },
      { id: "a0000000-0000-0000-0000-000000000005", formato: "resposta_curta", enunciado: "851", gabarito: { aceitas: ["eight hundred and fifty-one", "eight hundred fifty-one"] } },
      { id: "a0000000-0000-0000-0000-000000000006", formato: "completar_letras", enunciado: "Co_bustible", gabarito: { lacunas: [["m"]] } },
    ],
  }],
};
const { rows: [{ salvar_lista: idLista }] } = await como(PROFESSOR, "select public.salvar_lista($1::jsonb)", [JSON.stringify(lista)]);
conferir(!!idLista, "professora salva lista");
conferir(await falhaComo(ALUNO, "select public.salvar_lista($1::jsonb)", [JSON.stringify(lista)]), "aluno não salva lista");
conferir((await numero(ALUNO, "select count(*) from public.gabaritos")) === 0, "aluno não lê gabaritos");

const respostas = {
  "a0000000-0000-0000-0000-000000000001": { opcao: 1 },
  "a0000000-0000-0000-0000-000000000002": { valor: false },
  "a0000000-0000-0000-0000-000000000003": { lacunas: ["  este. ", "ESA"] },
  "a0000000-0000-0000-0000-000000000004": { lacunas: [0] },
  "a0000000-0000-0000-0000-000000000005": { texto: "Eight hundred fifty one" },
  "a0000000-0000-0000-0000-000000000006": { lacunas: ["M"] },
};
const { rows: [{ enviar_tentativa: resultado }] } = await como(ALUNO, "select public.enviar_tentativa($1, $2::jsonb)", [idLista, JSON.stringify(respostas)]);
conferir(resultado.acertos === 5 && resultado.total === 6 && Number(resultado.nota) === 83, `correção: 5 de 6, nota 83 (veio ${resultado.acertos}/${resultado.total}, ${resultado.nota})`);
conferir(resultado.questoes["a0000000-0000-0000-0000-000000000004"].fracao === 0, "opção errada na lacuna conta como erro");

lista.id = idLista;
lista.secoes[0].questoes.pop();
await como(PROFESSOR, "select public.salvar_lista($1::jsonb)", [JSON.stringify(lista)]);
conferir((await numero(PROFESSOR, "select count(*) from public.questoes where lista_id = $1", [idLista])) === 5, "remover questão no editor apaga só ela");

await como(PROFESSOR, "update public.listas set status = 'rascunho' where id = $1", [idLista]);
conferir((await numero(ALUNO, "select count(*) from public.listas")) === 0, "rascunho some para o aluno");
await como(PROFESSOR, "update public.listas set status = 'publicada' where id = $1", [idLista]);

// ----------------------------------------------------------------------------- IA: cota e configuração
console.log("Assistente e áudio");
await como(PROFESSOR, "insert into public.geracoes_ia (habilidade, provedor, modelo, ok) values ('gerar_lista','gemini','x', true), ('gerar_lista','gemini','x', false), ('gerar_audio','gemini','tts', true), ('gerar_audio','gemini','tts', true)");
conferir((await numero(PROFESSOR, "select public.geracoes_hoje()")) === 1, "cota de listas conta só as que deram certo");
conferir((await numero(PROFESSOR, "select public.geracoes_hoje('gerar_audio')")) === 2, "cota de áudio é separada");
conferir(await falhaComo(ALUNO, "insert into public.geracoes_ia (habilidade, provedor, modelo, ok) values ('gerar_lista','gemini','x', true)"), "aluno não registra geração");
conferir((await numero(ALUNO, "select count(*) from public.config_ia")) === 0, "aluno não vê a configuração de IA");
conferir(
  await barrado(PROFESSOR, "update public.config_ia set limite_diario = 999", async () => (await numero(ADMIN, "select max(limite_diario) from public.config_ia")) < 999),
  "professora não muda a configuração de IA",
);

await como(PROFESSOR, "insert into storage.objects (bucket_id, name) values ('audios', 'x.mp3')");
conferir((await numero(PROFESSOR, "select count(*) from storage.objects where bucket_id = 'audios'")) === 1, "professora envia e lê áudios");
conferir(await falhaComo(ALUNO, "insert into storage.objects (bucket_id, name) values ('audios', 'y.mp3')"), "aluno não envia áudio");

// ----------------------------------------------------------------------------- bloqueio
console.log("Bloqueio");
conferir(await falhaComo(ALUNO, `update public.perfis set bloqueado = true where id = '${ALUNO}'`), "aluno não mexe no próprio bloqueio");
conferir(await falhaComo(ADMIN, `update public.perfis set bloqueado = true where id = '${ADMIN}'`), "admin não se bloqueia");
conferir(
  await barrado(PROFESSOR, `update public.perfis set bloqueado = true where id = '${ALUNO}'`, async () => (await numero(ADMIN, "select count(*) from public.perfis where bloqueado")) === 0),
  "professora não bloqueia ninguém",
);
await como(ADMIN, `update public.perfis set bloqueado = true where id in ('${ALUNO}', '${PROFESSOR}')`);
conferir((await numero(ALUNO, "select count(*) from public.listas")) === 0, "aluno bloqueado não vê listas");
conferir(await falhaComo(ALUNO, "select public.enviar_tentativa($1, '{}'::jsonb)", [idLista]), "aluno bloqueado não envia respostas");
conferir((await numero(ALUNO, "select count(*) from public.perfis where bloqueado")) === 1, "aluno bloqueado ainda lê o próprio perfil");
conferir(await falhaComo(PROFESSOR, "select public.salvar_lista($1::jsonb)", [JSON.stringify(lista)]), "professora bloqueada não salva lista");
await como(ADMIN, `update public.perfis set bloqueado = false where id in ('${ALUNO}', '${PROFESSOR}')`);
conferir((await numero(ALUNO, "select count(*) from public.listas")) === 1, "desbloqueado volta a ver as listas");

// ----------------------------------------------------------------------------- aulas com PDF
console.log("Aulas com PDF");
const { rows: [{ id: idCurso }] } = await como(PROFESSOR, "insert into public.cursos (titulo, idioma, nivel) values ('Inglês Beginner', 'ingles', 1) returning id");
const { rows: [{ id: idAula }] } = await como(PROFESSOR, "insert into public.aulas (curso_id, numero, titulo, material_arquivo, material_nome) values ($1, 1, 'Numbers', 'aula-1.pdf', 'ENGLISH CLASS - NUMBERS.pdf') returning id", [idCurso]);
conferir(!!idAula, "professora cria aula com PDF");
await como(PROFESSOR, "insert into storage.objects (bucket_id, name) values ('materiais', 'aula-1.pdf')");
await como(PROFESSOR, "insert into public.aula_listas (aula_id, lista_id) values ($1, $2)", [idAula, idLista]);
conferir((await numero(PROFESSOR, "select count(*) from public.aula_listas")) === 1, "professora liga exercício à aula");
conferir(await falhaComo(ALUNO, "insert into storage.objects (bucket_id, name) values ('materiais', 'pirata.pdf')"), "aluno não envia material");
conferir((await numero(ALUNO, "select count(*) from storage.objects where bucket_id = 'materiais'")) === 0, "aluno sem turma não lê o PDF");
conferir((await numero(ALUNO, "select count(*) from public.aula_listas")) === 0, "aluno sem turma não vê os exercícios da aula");

// Sem "returning": a regra de leitura da turma não enxerga a linha no mesmo comando que a cria (o site também não pede o retorno).
await como(PROFESSOR, "insert into public.turmas (nome, curso_id) values ('Turma A', $1)", [idCurso]);
const { rows: [{ id: idTurma, codigo }] } = await como(PROFESSOR, "select id, codigo from public.turmas where curso_id = $1", [idCurso]);
await como(ALUNO, "select public.entrar_na_turma($1)", [codigo]);
conferir((await numero(ALUNO, "select count(*) from storage.objects where bucket_id = 'materiais'")) === 0, "aula ainda não liberada: PDF continua fechado");
await como(PROFESSOR, "insert into public.aulas_liberadas (turma_id, aula_id) values ($1, $2)", [idTurma, idAula]);
conferir((await numero(ALUNO, "select count(*) from storage.objects where bucket_id = 'materiais'")) === 1, "aula liberada: aluno da turma lê o PDF");
conferir((await numero(ALUNO, "select count(*) from public.aula_listas")) === 1, "aula liberada: aluno vê os exercícios da aula");
conferir((await numero(OUTRO_ALUNO, "select count(*) from storage.objects where bucket_id = 'materiais'")) === 0, "aluno de outra turma não lê o PDF");

// ----------------------------------------------------------------------------- listas de exemplo
console.log("Listas de exemplo");
const SQL_EXEMPLOS = fs.readFileSync(path.resolve(PASTA_MIGRACOES, "../exemplos/listas_de_exemplo.sql"), "utf8");
await db.exec(SQL_EXEMPLOS);
await db.exec(SQL_EXEMPLOS); // rodar de novo recria, sem duplicar
conferir((await numero(OUTRO_ALUNO, "select count(*) from public.listas where origem = 'exemplo' and status = 'publicada'")) === 25, "25 listas de exemplo publicadas, visíveis para o aluno");
conferir((await numero(ADMIN, "select count(*) from public.listas where origem = 'exemplo' and criado_por = $1", [ADMIN])) === 25, "exemplos ficam em nome do admin");

// Responde cada lista com o próprio gabarito: tudo precisa dar 100%.
const { rows: exemplos } = await db.query("select id, titulo from public.listas where origem = 'exemplo'");
const erradas = [];
for (const { id, titulo } of exemplos) {
  const { rows: questoes } = await db.query("select q.id, q.formato, g.gabarito from public.questoes q join public.gabaritos g on g.questao_id = q.id where q.lista_id = $1", [id]);
  const respostasCertas = {};
  for (const { id: idQuestao, formato, gabarito } of questoes) {
    respostasCertas[idQuestao] =
      formato === "multipla_escolha" ? { opcao: gabarito.correta }
      : formato === "verdadeiro_falso" ? { valor: gabarito.valor }
      : formato === "resposta_curta" ? { texto: gabarito.aceitas[0] }
      : formato === "lacuna_opcoes" ? { lacunas: gabarito.lacunas }
      : { lacunas: gabarito.lacunas.map((aceitas) => aceitas[0]) };
  }
  const { rows: [{ enviar_tentativa: r }] } = await como(OUTRO_ALUNO, "select public.enviar_tentativa($1, $2::jsonb)", [id, JSON.stringify(respostasCertas)]);
  if (Number(r.nota) !== 100) erradas.push(`${titulo} (${r.nota}%)`);
}
conferir(erradas.length === 0, `gabarito de cada exemplo corrige como 100%${erradas.length ? `: ${erradas.join(", ")}` : ""}`);

console.log(falhas === 0 ? "\nTudo certo." : `\n${falhas} verificação(ões) falharam.`);
process.exit(falhas === 0 ? 0 : 1);
