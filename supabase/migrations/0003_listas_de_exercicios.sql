-- Listas de exercícios: listas -> seções -> questões, gabarito protegido e correção no servidor.
-- Rodar no Supabase: SQL Editor -> colar este arquivo -> Run (depois do 0001 e do 0002).

create type public.status_lista as enum ('rascunho', 'publicada');
create type public.formato_questao as enum (
  'multipla_escolha',  -- conteudo {opcoes: [texto]}            gabarito {correta: índice}
  'verdadeiro_falso',  -- conteudo {}                           gabarito {valor: true|false}
  'lacuna',            -- enunciado com ___                     gabarito {lacunas: [[aceitas]], ignorar_acentos}
  'lacuna_opcoes',     -- conteudo {opcoes: [[texto]] por lacuna} gabarito {lacunas: [índice]}
  'resposta_curta',    -- conteudo {}                           gabarito {aceitas: [texto], ignorar_acentos}
  'completar_letras'   -- enunciado tipo "Co_bustible"          gabarito igual ao da lacuna
);
create type public.habilidade as enum ('listening', 'reading', 'grammar', 'vocabulary', 'writing');
create type public.tipo_estimulo as enum ('nenhum', 'texto', 'audio', 'dica');

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table public.listas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(trim(titulo)) > 0),
  tema text not null default '',
  descricao text not null default '',
  idioma public.idioma not null,
  nivel smallint not null check (nivel between 1 and 6),
  status public.status_lista not null default 'rascunho',
  origem text not null default 'manual',
  -- Para quando cursos e aulas voltarem (docs/cursos-e-turmas.md).
  aula_id uuid references public.aulas (id) on delete set null,
  criado_por uuid default auth.uid() references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.secoes (
  id uuid primary key default gen_random_uuid(),
  lista_id uuid not null references public.listas (id) on delete cascade,
  ordem integer not null default 0,
  titulo text not null default '',
  instrucao text not null default '',
  tipo_estimulo public.tipo_estimulo not null default 'nenhum',
  -- texto: {texto}; dica: {texto}; audio (fase 2): {roteiro, vozes, audio_url, transcricao}
  estimulo jsonb not null default '{}'
);
create index secoes_lista on public.secoes (lista_id, ordem);

create table public.questoes (
  id uuid primary key default gen_random_uuid(),
  secao_id uuid not null references public.secoes (id) on delete cascade,
  lista_id uuid not null references public.listas (id) on delete cascade,
  ordem integer not null default 0,
  formato public.formato_questao not null,
  habilidade public.habilidade not null default 'grammar',
  enunciado text not null default '',
  conteudo jsonb not null default '{}',
  pontos numeric not null default 1 check (pontos > 0)
);
create index questoes_secao on public.questoes (secao_id, ordem);
create index questoes_lista on public.questoes (lista_id);

-- Separado das questões para o aluno não conseguir ler a resposta antes de enviar.
create table public.gabaritos (
  questao_id uuid primary key references public.questoes (id) on delete cascade,
  gabarito jsonb not null default '{}',
  explicacao text not null default ''
);

create table public.tentativas (
  id uuid primary key default gen_random_uuid(),
  lista_id uuid not null references public.listas (id) on delete cascade,
  aluno_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  enviada_em timestamptz not null default now(),
  acertos integer not null default 0,
  total integer not null default 0,
  nota numeric not null default 0
);
create index tentativas_aluno on public.tentativas (aluno_id, lista_id);

create table public.respostas (
  tentativa_id uuid not null references public.tentativas (id) on delete cascade,
  questao_id uuid not null references public.questoes (id) on delete cascade,
  resposta jsonb not null default '{}',
  fracao numeric not null default 0,
  pontos numeric not null default 0,
  primary key (tentativa_id, questao_id)
);

-- ---------------------------------------------------------------------------
-- Correção
-- ---------------------------------------------------------------------------

-- Compara respostas digitadas sem se importar com maiúsculas, espaços, hífens e pontuação nas pontas.
-- Acentos contam (Éste x Este), a menos que o gabarito diga para ignorar.
create function public.normalizar_resposta(texto text, ignorar_acentos boolean default false)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  s text := lower(coalesce(texto, ''));
begin
  s := replace(replace(s, '’', ''''), '‘', '''');
  s := regexp_replace(s, '[-‐–—]', ' ', 'g');
  s := regexp_replace(s, '^[[:space:].,;:!?¿¡"“”]+|[[:space:].,;:!?¿¡"“”]+$', '', 'g');
  s := regexp_replace(s, '[[:space:]]+', ' ', 'g');
  if ignorar_acentos then
    s := translate(s, 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
  end if;
  return s;
end;
$$;

-- Devolve de 0 a 1: quanto da questão o aluno acertou (lacunas contam parcialmente).
create function public.corrigir_questao(formato public.formato_questao, gabarito jsonb, resposta jsonb)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  total integer;
  certas integer := 0;
  i integer;
  ignorar boolean := coalesce((gabarito ->> 'ignorar_acentos')::boolean, false);
begin
  if resposta is null then
    return 0;
  end if;

  case formato
    when 'multipla_escolha' then
      return case when (resposta ->> 'opcao') = (gabarito ->> 'correta') then 1 else 0 end;

    when 'verdadeiro_falso' then
      return case when (resposta -> 'valor') = (gabarito -> 'valor') then 1 else 0 end;

    when 'lacuna', 'completar_letras' then
      total := coalesce(jsonb_array_length(gabarito -> 'lacunas'), 0);
      if total = 0 then return 0; end if;
      for i in 0 .. total - 1 loop
        if exists (
          select 1 from jsonb_array_elements_text(gabarito -> 'lacunas' -> i) as aceita
          where public.normalizar_resposta(aceita, ignorar)
              = public.normalizar_resposta(resposta -> 'lacunas' ->> i, ignorar)
            and public.normalizar_resposta(resposta -> 'lacunas' ->> i, ignorar) <> ''
        ) then
          certas := certas + 1;
        end if;
      end loop;
      return certas::numeric / total;

    when 'lacuna_opcoes' then
      total := coalesce(jsonb_array_length(gabarito -> 'lacunas'), 0);
      if total = 0 then return 0; end if;
      for i in 0 .. total - 1 loop
        if (resposta -> 'lacunas' ->> i) = (gabarito -> 'lacunas' ->> i) then
          certas := certas + 1;
        end if;
      end loop;
      return certas::numeric / total;

    when 'resposta_curta' then
      return case when exists (
        select 1 from jsonb_array_elements_text(gabarito -> 'aceitas') as aceita
        where public.normalizar_resposta(aceita, ignorar) = public.normalizar_resposta(resposta ->> 'texto', ignorar)
          and public.normalizar_resposta(resposta ->> 'texto', ignorar) <> ''
      ) then 1 else 0 end;
  end case;
  return 0;
end;
$$;

-- ---------------------------------------------------------------------------
-- Funções de permissão
-- ---------------------------------------------------------------------------

create function public.lista_visivel(lista uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.eh_equipe()
      or exists (select 1 from public.listas where id = lista and status = 'publicada')
$$;

-- ---------------------------------------------------------------------------
-- Salvar a lista inteira de uma vez (editor do professor)
-- ---------------------------------------------------------------------------
-- Recebe {id?, titulo, tema, descricao, idioma, nivel, status,
--         secoes: [{id, titulo, instrucao, tipo_estimulo, estimulo,
--                   questoes: [{id, formato, habilidade, enunciado, conteudo, pontos, gabarito, explicacao}]}]}.
-- Atualiza o que já existe pelo id, cria o que é novo e apaga o que saiu do editor.
create function public.salvar_lista(dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  id_lista uuid := coalesce((dados ->> 'id')::uuid, gen_random_uuid());
  secao jsonb;
  questao jsonb;
  ordem_secao integer := 0;
  ordem_questao integer;
  ids_secoes uuid[] := '{}';
  ids_questoes uuid[] := '{}';
  id_secao uuid;
  id_questao uuid;
begin
  if not public.eh_equipe() then
    raise exception 'Só professores e admins podem editar listas.';
  end if;

  insert into public.listas (id, titulo, tema, descricao, idioma, nivel, status, origem)
  values (
    id_lista,
    dados ->> 'titulo',
    coalesce(dados ->> 'tema', ''),
    coalesce(dados ->> 'descricao', ''),
    (dados ->> 'idioma')::public.idioma,
    (dados ->> 'nivel')::smallint,
    coalesce(dados ->> 'status', 'rascunho')::public.status_lista,
    coalesce(dados ->> 'origem', 'manual')
  )
  on conflict (id) do update set
    titulo = excluded.titulo,
    tema = excluded.tema,
    descricao = excluded.descricao,
    idioma = excluded.idioma,
    nivel = excluded.nivel,
    status = excluded.status,
    atualizado_em = now();

  for secao in select * from jsonb_array_elements(coalesce(dados -> 'secoes', '[]')) loop
    id_secao := coalesce((secao ->> 'id')::uuid, gen_random_uuid());
    ids_secoes := ids_secoes || id_secao;
    insert into public.secoes (id, lista_id, ordem, titulo, instrucao, tipo_estimulo, estimulo)
    values (
      id_secao, id_lista, ordem_secao,
      coalesce(secao ->> 'titulo', ''),
      coalesce(secao ->> 'instrucao', ''),
      coalesce(secao ->> 'tipo_estimulo', 'nenhum')::public.tipo_estimulo,
      coalesce(secao -> 'estimulo', '{}')
    )
    on conflict (id) do update set
      ordem = excluded.ordem, titulo = excluded.titulo, instrucao = excluded.instrucao,
      tipo_estimulo = excluded.tipo_estimulo, estimulo = excluded.estimulo
    where public.secoes.lista_id = id_lista;
    ordem_secao := ordem_secao + 1;

    ordem_questao := 0;
    for questao in select * from jsonb_array_elements(coalesce(secao -> 'questoes', '[]')) loop
      id_questao := coalesce((questao ->> 'id')::uuid, gen_random_uuid());
      ids_questoes := ids_questoes || id_questao;
      insert into public.questoes (id, secao_id, lista_id, ordem, formato, habilidade, enunciado, conteudo, pontos)
      values (
        id_questao, id_secao, id_lista, ordem_questao,
        (questao ->> 'formato')::public.formato_questao,
        coalesce(questao ->> 'habilidade', 'grammar')::public.habilidade,
        coalesce(questao ->> 'enunciado', ''),
        coalesce(questao -> 'conteudo', '{}'),
        coalesce((questao ->> 'pontos')::numeric, 1)
      )
      on conflict (id) do update set
        secao_id = excluded.secao_id, ordem = excluded.ordem, formato = excluded.formato,
        habilidade = excluded.habilidade, enunciado = excluded.enunciado,
        conteudo = excluded.conteudo, pontos = excluded.pontos
      where public.questoes.lista_id = id_lista;

      insert into public.gabaritos (questao_id, gabarito, explicacao)
      values (id_questao, coalesce(questao -> 'gabarito', '{}'), coalesce(questao ->> 'explicacao', ''))
      on conflict (questao_id) do update set gabarito = excluded.gabarito, explicacao = excluded.explicacao;

      ordem_questao := ordem_questao + 1;
    end loop;
  end loop;

  delete from public.questoes where lista_id = id_lista and not (id = any (ids_questoes));
  delete from public.secoes where lista_id = id_lista and not (id = any (ids_secoes));
  return id_lista;
end;
$$;

-- ---------------------------------------------------------------------------
-- Enviar respostas: corrige no servidor e devolve o resultado com gabarito e explicações
-- ---------------------------------------------------------------------------
create function public.enviar_tentativa(id_lista uuid, respostas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  id_tentativa uuid;
  q record;
  fracao numeric;
  resposta jsonb;
  pontos_total numeric := 0;
  pontos_obtidos numeric := 0;
  qtd_acertos integer := 0;
  qtd_total integer := 0;
  resultado jsonb := '{}';
  nota_final numeric;
begin
  if auth.uid() is null then
    raise exception 'Faça login para enviar as respostas.';
  end if;
  if not public.lista_visivel(id_lista) then
    raise exception 'Essa lista não está disponível.';
  end if;

  insert into public.tentativas (lista_id, aluno_id) values (id_lista, auth.uid())
  returning id into id_tentativa;

  for q in
    select qu.id, qu.formato, qu.pontos, coalesce(g.gabarito, '{}') as gabarito, coalesce(g.explicacao, '') as explicacao
    from public.questoes qu left join public.gabaritos g on g.questao_id = qu.id
    where qu.lista_id = id_lista
  loop
    resposta := respostas -> q.id::text;
    fracao := public.corrigir_questao(q.formato, q.gabarito, resposta);
    insert into public.respostas (tentativa_id, questao_id, resposta, fracao, pontos)
    values (id_tentativa, q.id, coalesce(resposta, '{}'), fracao, q.pontos * fracao);

    pontos_total := pontos_total + q.pontos;
    pontos_obtidos := pontos_obtidos + q.pontos * fracao;
    qtd_total := qtd_total + 1;
    if fracao = 1 then qtd_acertos := qtd_acertos + 1; end if;

    resultado := resultado || jsonb_build_object(q.id::text, jsonb_build_object(
      'fracao', fracao, 'gabarito', q.gabarito, 'explicacao', q.explicacao
    ));
  end loop;

  nota_final := case when pontos_total > 0 then round(pontos_obtidos / pontos_total * 100) else 0 end;
  update public.tentativas set acertos = qtd_acertos, total = qtd_total, nota = nota_final where id = id_tentativa;

  return jsonb_build_object(
    'tentativa_id', id_tentativa, 'nota', nota_final,
    'acertos', qtd_acertos, 'total', qtd_total, 'questoes', resultado
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Políticas
-- ---------------------------------------------------------------------------

alter table public.listas enable row level security;
alter table public.secoes enable row level security;
alter table public.questoes enable row level security;
alter table public.gabaritos enable row level security;
alter table public.tentativas enable row level security;
alter table public.respostas enable row level security;

-- Por enquanto, lista publicada aparece para todo aluno logado (cursos e turmas estão em espera).
create policy "equipe vê tudo; aluno vê as publicadas" on public.listas
  for select to authenticated using (public.lista_visivel(id));
create policy "equipe apaga listas" on public.listas
  for delete to authenticated using (public.eh_equipe());
create policy "equipe muda status" on public.listas
  for update to authenticated using (public.eh_equipe()) with check (public.eh_equipe());

create policy "seções das listas visíveis" on public.secoes
  for select to authenticated using (public.lista_visivel(lista_id));
create policy "questões das listas visíveis" on public.questoes
  for select to authenticated using (public.lista_visivel(lista_id));

create policy "só a equipe lê gabaritos" on public.gabaritos
  for select to authenticated using (public.eh_equipe());

create policy "aluno vê as próprias tentativas; equipe vê todas" on public.tentativas
  for select to authenticated using (aluno_id = auth.uid() or public.eh_equipe());
create policy "respostas das tentativas visíveis" on public.respostas
  for select to authenticated using (
    public.eh_equipe() or exists (select 1 from public.tentativas t where t.id = tentativa_id and t.aluno_id = auth.uid())
  );

-- Gravações passam pelas funções salvar_lista e enviar_tentativa; direto só leitura e pouco mais.
grant select, delete on public.listas to authenticated;
grant update (status) on public.listas to authenticated;
grant select on public.secoes, public.questoes, public.gabaritos, public.tentativas, public.respostas to authenticated;

revoke execute on function public.salvar_lista(jsonb) from public, anon;
revoke execute on function public.enviar_tentativa(uuid, jsonb) from public, anon;
grant execute on function public.salvar_lista(jsonb) to authenticated;
grant execute on function public.enviar_tentativa(uuid, jsonb) to authenticated;
