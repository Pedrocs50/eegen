-- Turmas de verdade: o aluno entra pelo código, a professora aprova, e o aluno só vê o que foi liberado para a turma.
--
-- 1. Matrícula com situação: "pendente" (pediu para entrar) ou "aprovada". As que já existiam ficam aprovadas.
-- 2. Exercícios avulsos por turma (turma_listas), além dos exercícios de cada aula.
-- 3. Lista visível para o aluno = publicada E (está numa aula liberada para a turma dele OU é avulsa da turma dele).
--    Antes, toda lista publicada aparecia para qualquer pessoa cadastrada.
-- 4. Cadastro com código: o código vai junto no cadastro e já cria o pedido de entrada.

-- ---------------------------------------------------------------------------
-- 1. Matrícula com aprovação
-- ---------------------------------------------------------------------------
alter table public.matriculas add column situacao text not null default 'pendente' check (situacao in ('pendente', 'aprovada'));
alter table public.matriculas add column aprovada_em timestamptz;
update public.matriculas set situacao = 'aprovada', aprovada_em = criado_em;

-- Inscrito em qualquer situação: o aluno pendente vê o nome da turma para saber que está aguardando.
create function public.inscrito_na_turma(turma uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.ativo() and exists (select 1 from public.matriculas where turma_id = turma and aluno_id = auth.uid())
$$;

-- Conteúdo (cursos, aulas, PDFs, exercícios) só com matrícula aprovada.
create or replace function public.aluno_da_turma(turma uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.ativo() and exists (
    select 1 from public.matriculas where turma_id = turma and aluno_id = auth.uid() and situacao = 'aprovada'
  )
$$;

create or replace function public.aluno_ve_curso(curso uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.ativo() and exists (
    select 1 from public.matriculas m join public.turmas t on t.id = m.turma_id
    where t.curso_id = curso and m.aluno_id = auth.uid() and m.situacao = 'aprovada'
  )
$$;

create or replace function public.aluno_ve_aula(aula uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.ativo() and exists (
    select 1 from public.aulas_liberadas l join public.matriculas m on m.turma_id = l.turma_id
    where l.aula_id = aula and m.aluno_id = auth.uid() and m.situacao = 'aprovada'
  )
$$;

drop policy "professor vê as suas turmas; aluno as em que está" on public.turmas;
create policy "professor vê as suas turmas; aluno as em que está" on public.turmas
  for select to authenticated using (public.gerencia_turma(id) or public.inscrito_na_turma(id));

-- A professora aprova (muda a situação); recusar é apagar o pedido (política de remoção que já existe).
create policy "professor aprova matrículas" on public.matriculas
  for update to authenticated using (public.gerencia_turma(turma_id)) with check (public.gerencia_turma(turma_id));
grant update (situacao, aprovada_em) on public.matriculas to authenticated;

-- Entrar pelo código agora cria um pedido; quem já está na turma continua como está.
create or replace function public.entrar_na_turma(codigo_turma text)
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

-- Para a tela de cadastro (ainda sem login): confere o código e mostra o nome da turma antes de criar a conta.
create function public.conferir_codigo_turma(codigo_turma text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('turma', t.nome, 'curso', c.titulo, 'idioma', c.idioma, 'professor', p.nome)
  from public.turmas t
  join public.cursos c on c.id = t.curso_id
  left join public.perfis p on p.id = t.professor_id
  where t.codigo = upper(trim(codigo_turma)) and t.ativa
$$;
revoke execute on function public.conferir_codigo_turma(text) from public;
grant execute on function public.conferir_codigo_turma(text) to anon, authenticated;

-- Cadastro com código: o perfil nasce e o pedido de entrada na turma já fica registrado.
-- (Sem código, ou com código inválido, a conta é criada mas não vê nada até entrar numa turma.)
create or replace function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  id_turma uuid;
begin
  insert into public.perfis (id, nome, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nome', ''), new.email);

  select id into id_turma from public.turmas
  where codigo = upper(trim(coalesce(new.raw_user_meta_data ->> 'codigo_turma', ''))) and ativa;
  if id_turma is not null then
    insert into public.matriculas (turma_id, aluno_id) values (id_turma, new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Exercícios avulsos da turma
-- ---------------------------------------------------------------------------
create table public.turma_listas (
  turma_id uuid not null references public.turmas (id) on delete cascade,
  lista_id uuid not null references public.listas (id) on delete cascade,
  ordem integer not null default 0,
  liberada_em timestamptz not null default now(),
  primary key (turma_id, lista_id)
);
create index turma_listas_lista on public.turma_listas (lista_id);

alter table public.turma_listas enable row level security;
create policy "turma vê os exercícios avulsos" on public.turma_listas
  for select to authenticated using (public.gerencia_turma(turma_id) or public.aluno_da_turma(turma_id));
create policy "professor libera exercícios avulsos" on public.turma_listas
  for insert to authenticated with check (public.gerencia_turma(turma_id));
create policy "professor reordena exercícios avulsos" on public.turma_listas
  for update to authenticated using (public.gerencia_turma(turma_id)) with check (public.gerencia_turma(turma_id));
create policy "professor recolhe exercícios avulsos" on public.turma_listas
  for delete to authenticated using (public.gerencia_turma(turma_id));
grant select, insert, delete on public.turma_listas to authenticated;
grant update (ordem) on public.turma_listas to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Quem vê cada lista
-- ---------------------------------------------------------------------------
create or replace function public.lista_visivel(lista uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.eh_equipe()
      or (
        public.ativo()
        and exists (select 1 from public.listas where id = lista and status = 'publicada')
        and (
          exists (
            select 1
            from public.aula_listas al
            join public.aulas_liberadas lib on lib.aula_id = al.aula_id
            join public.matriculas m on m.turma_id = lib.turma_id
            where al.lista_id = lista and m.aluno_id = auth.uid() and m.situacao = 'aprovada'
          )
          or exists (
            select 1
            from public.turma_listas tl
            join public.matriculas m on m.turma_id = tl.turma_id
            where tl.lista_id = lista and m.aluno_id = auth.uid() and m.situacao = 'aprovada'
          )
        )
      )
$$;
