-- Cursos, aulas, turmas, matrículas e aulas liberadas por turma.
-- Rodar no Supabase: SQL Editor -> colar este arquivo -> Run (depois do 0001).

create type public.idioma as enum ('ingles', 'espanhol');

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table public.cursos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(trim(titulo)) > 0),
  idioma public.idioma not null,
  -- 1 a 6; os nomes de cada nível por idioma ficam no site (lib/dados.ts).
  nivel smallint not null check (nivel between 1 and 6),
  descricao text not null default '',
  criado_por uuid default auth.uid() references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);

create table public.aulas (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos (id) on delete cascade,
  numero integer not null check (numero > 0),
  titulo text not null check (length(trim(titulo)) > 0),
  subtitulo text not null default '',
  material_url text not null default '' check (material_url = '' or material_url ~* '^https?://'),
  criado_em timestamptz not null default now()
);
create index aulas_curso on public.aulas (curso_id, numero);

-- Código curto para o aluno digitar, sem letras ambíguas (0/O, 1/I).
create function public.gerar_codigo_turma()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 6)
$$;

create table public.turmas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  curso_id uuid not null references public.cursos (id) on delete cascade,
  professor_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  codigo text not null unique default public.gerar_codigo_turma(),
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);
create index turmas_professor on public.turmas (professor_id);

create table public.matriculas (
  turma_id uuid not null references public.turmas (id) on delete cascade,
  aluno_id uuid not null references public.perfis (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (turma_id, aluno_id)
);
create index matriculas_aluno on public.matriculas (aluno_id);

create table public.aulas_liberadas (
  turma_id uuid not null references public.turmas (id) on delete cascade,
  aula_id uuid not null references public.aulas (id) on delete cascade,
  liberada_em timestamptz not null default now(),
  primary key (turma_id, aula_id)
);

-- Só dá para liberar uma aula do mesmo curso da turma.
create function public.checar_liberacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.turmas t join public.aulas a on a.curso_id = t.curso_id
    where t.id = new.turma_id and a.id = new.aula_id
  ) then
    raise exception 'Essa aula não pertence ao curso da turma.';
  end if;
  return new;
end;
$$;

create trigger checar_liberacao
  before insert on public.aulas_liberadas
  for each row execute function public.checar_liberacao();

-- ---------------------------------------------------------------------------
-- Funções de permissão ("security definer" evita recursão entre as políticas)
-- ---------------------------------------------------------------------------

create function public.eh_equipe()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select papel in ('admin', 'professor') from public.perfis where id = auth.uid()), false)
$$;

create function public.gerencia_turma(turma uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.meu_papel() = 'admin'
      or exists (select 1 from public.turmas where id = turma and professor_id = auth.uid())
$$;

create function public.aluno_da_turma(turma uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.matriculas where turma_id = turma and aluno_id = auth.uid())
$$;

create function public.aluno_ve_curso(curso uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.matriculas m join public.turmas t on t.id = m.turma_id
    where t.curso_id = curso and m.aluno_id = auth.uid()
  )
$$;

create function public.aluno_ve_aula(aula uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.aulas_liberadas l join public.matriculas m on m.turma_id = l.turma_id
    where l.aula_id = aula and m.aluno_id = auth.uid()
  )
$$;

-- Professor vê o nome dos alunos das suas turmas; aluno vê o nome dos seus professores.
create function public.pessoa_da_minha_turma(pessoa uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.matriculas m join public.turmas t on t.id = m.turma_id
    where (t.professor_id = auth.uid() and m.aluno_id = pessoa)
       or (m.aluno_id = auth.uid() and t.professor_id = pessoa)
  )
$$;

-- Entrar na turma pelo código. O aluno não consegue listar turmas, só usar um código válido.
create function public.entrar_na_turma(codigo_turma text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  id_turma uuid;
begin
  if auth.uid() is null then
    raise exception 'Faça login para entrar na turma.';
  end if;
  select id into id_turma from public.turmas
  where codigo = upper(trim(codigo_turma)) and ativa;
  if id_turma is null then
    raise exception 'Código de turma não encontrado. Confira com a sua professora.';
  end if;
  insert into public.matriculas (turma_id, aluno_id) values (id_turma, auth.uid())
  on conflict do nothing;
  return id_turma;
end;
$$;

-- ---------------------------------------------------------------------------
-- Políticas
-- ---------------------------------------------------------------------------

alter table public.cursos enable row level security;
alter table public.aulas enable row level security;
alter table public.turmas enable row level security;
alter table public.matriculas enable row level security;
alter table public.aulas_liberadas enable row level security;

create policy "equipe e alunos matriculados veem cursos" on public.cursos
  for select to authenticated using (public.eh_equipe() or public.aluno_ve_curso(id));
create policy "equipe cria cursos" on public.cursos
  for insert to authenticated with check (public.eh_equipe());
create policy "equipe edita cursos" on public.cursos
  for update to authenticated using (public.eh_equipe()) with check (public.eh_equipe());
create policy "equipe apaga cursos" on public.cursos
  for delete to authenticated using (public.eh_equipe());

create policy "equipe vê aulas; aluno só as liberadas" on public.aulas
  for select to authenticated using (public.eh_equipe() or public.aluno_ve_aula(id));
create policy "equipe cria aulas" on public.aulas
  for insert to authenticated with check (public.eh_equipe());
create policy "equipe edita aulas" on public.aulas
  for update to authenticated using (public.eh_equipe()) with check (public.eh_equipe());
create policy "equipe apaga aulas" on public.aulas
  for delete to authenticated using (public.eh_equipe());

create policy "professor vê as suas turmas; aluno as em que está" on public.turmas
  for select to authenticated using (public.gerencia_turma(id) or public.aluno_da_turma(id));
create policy "equipe cria turmas para si" on public.turmas
  for insert to authenticated
  with check (public.eh_equipe() and (professor_id = auth.uid() or public.meu_papel() = 'admin'));
create policy "professor edita as suas turmas" on public.turmas
  for update to authenticated using (public.gerencia_turma(id)) with check (public.gerencia_turma(id));
create policy "professor apaga as suas turmas" on public.turmas
  for delete to authenticated using (public.gerencia_turma(id));

create policy "aluno vê as próprias matrículas; professor as da turma" on public.matriculas
  for select to authenticated using (aluno_id = auth.uid() or public.gerencia_turma(turma_id));
create policy "professor remove aluno; aluno sai da turma" on public.matriculas
  for delete to authenticated using (aluno_id = auth.uid() or public.gerencia_turma(turma_id));

create policy "turma vê as aulas liberadas" on public.aulas_liberadas
  for select to authenticated using (public.gerencia_turma(turma_id) or public.aluno_da_turma(turma_id));
create policy "professor libera aulas" on public.aulas_liberadas
  for insert to authenticated with check (public.gerencia_turma(turma_id));
create policy "professor recolhe aulas" on public.aulas_liberadas
  for delete to authenticated using (public.gerencia_turma(turma_id));

create policy "ver pessoas das minhas turmas" on public.perfis
  for select to authenticated using (public.pessoa_da_minha_turma(id));

-- ---------------------------------------------------------------------------
-- Permissões ("Automatically expose new tables" está desligado)
-- ---------------------------------------------------------------------------

grant select, insert, delete on public.cursos to authenticated;
grant update (titulo, idioma, nivel, descricao) on public.cursos to authenticated;
grant select, insert, delete on public.aulas to authenticated;
grant update (numero, titulo, subtitulo, material_url) on public.aulas to authenticated;
grant select, insert, delete on public.turmas to authenticated;
grant update (nome, ativa) on public.turmas to authenticated;
grant select, delete on public.matriculas to authenticated;
grant select, insert, delete on public.aulas_liberadas to authenticated;

revoke execute on function public.entrar_na_turma(text) from public, anon;
grant execute on function public.entrar_na_turma(text) to authenticated;
revoke execute on function public.checar_liberacao() from public, anon, authenticated;
