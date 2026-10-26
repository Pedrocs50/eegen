-- Exercícios do curso: listas que pertencem ao curso (não a uma aula), em ordem, e que cada turma libera no próprio ritmo.
-- Rodar no Supabase: SQL Editor -> colar este arquivo -> Run (depois do 0017).
--
-- 1. curso_listas: o "banco de exercícios" do curso. A equipe adiciona vários de uma vez (ex.: todos os de Elementary).
-- 2. curso_listas_liberadas: o que cada turma já liberou para os alunos (como aulas_liberadas).
-- 3. lista_visivel passa a contar os exercícios do curso liberados na turma do aluno.
-- 4. Liberar vários de uma vez gera um aviso só por aluno.

-- ---------------------------------------------------------------------------
-- 1. Exercícios do curso
-- ---------------------------------------------------------------------------
create table public.curso_listas (
  curso_id uuid not null references public.cursos (id) on delete cascade,
  lista_id uuid not null references public.listas (id) on delete cascade,
  ordem integer not null default 0,
  primary key (curso_id, lista_id)
);
create index curso_listas_lista on public.curso_listas (lista_id);

alter table public.curso_listas enable row level security;
create policy "equipe e alunos do curso veem os exercícios dele" on public.curso_listas
  for select to authenticated using (public.eh_equipe() or public.aluno_ve_curso(curso_id));
create policy "equipe coloca exercícios no curso" on public.curso_listas
  for insert to authenticated with check (public.eh_equipe());
create policy "equipe reordena exercícios do curso" on public.curso_listas
  for update to authenticated using (public.eh_equipe()) with check (public.eh_equipe());
create policy "equipe tira exercícios do curso" on public.curso_listas
  for delete to authenticated using (public.eh_equipe());
grant select, insert, delete on public.curso_listas to authenticated;
grant update (ordem) on public.curso_listas to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Liberação por turma
-- ---------------------------------------------------------------------------
create table public.curso_listas_liberadas (
  turma_id uuid not null references public.turmas (id) on delete cascade,
  lista_id uuid not null references public.listas (id) on delete cascade,
  liberada_em timestamptz not null default now(),
  primary key (turma_id, lista_id)
);
create index curso_listas_liberadas_lista on public.curso_listas_liberadas (lista_id);

-- Só dá para liberar um exercício que está no curso da turma.
create function public.checar_liberacao_de_exercicio()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.turmas t join public.curso_listas cl on cl.curso_id = t.curso_id
    where t.id = new.turma_id and cl.lista_id = new.lista_id
  ) then
    raise exception 'Este exercício não está no curso da turma.';
  end if;
  return new;
end;
$$;
create trigger checar_liberacao_de_exercicio
  before insert on public.curso_listas_liberadas
  for each row execute function public.checar_liberacao_de_exercicio();

alter table public.curso_listas_liberadas enable row level security;
create policy "turma vê os exercícios do curso liberados" on public.curso_listas_liberadas
  for select to authenticated using (public.gerencia_turma(turma_id) or public.aluno_da_turma(turma_id));
create policy "professor libera exercícios do curso" on public.curso_listas_liberadas
  for insert to authenticated with check (public.gerencia_turma(turma_id));
create policy "professor recolhe exercícios do curso" on public.curso_listas_liberadas
  for delete to authenticated using (public.gerencia_turma(turma_id));
grant select, insert, delete on public.curso_listas_liberadas to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Quem vê cada lista (igual à 0011, mais os exercícios do curso liberados; tirar a lista do curso esconde de novo)
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
          or exists (
            select 1
            from public.curso_listas_liberadas lib
            join public.turmas t on t.id = lib.turma_id
            join public.curso_listas cl on cl.curso_id = t.curso_id and cl.lista_id = lib.lista_id
            join public.matriculas m on m.turma_id = lib.turma_id
            where lib.lista_id = lista and m.aluno_id = auth.uid() and m.situacao = 'aprovada'
          )
        )
      )
$$;

-- ---------------------------------------------------------------------------
-- 4. Aviso aos alunos (um por comando, como nas aulas e nos extras)
-- ---------------------------------------------------------------------------
create function public.notificar_exercicios_do_curso()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  m record;
begin
  for r in
    select n.turma_id, count(*) as quantos, min(l.titulo) as titulo, min(l.id::text)::uuid as id_lista
    from novas n join public.listas l on l.id = n.lista_id
    where l.status = 'publicada'
    group by n.turma_id
  loop
    for m in select aluno_id from public.matriculas where turma_id = r.turma_id and situacao = 'aprovada' loop
      if r.quantos = 1 then
        perform public.notificar(m.aluno_id, 'exercicio_liberado', 'Exercício novo: ' || r.titulo,
          'A professora liberou um exercício do curso para a turma.', '/praticar/' || r.id_lista || '?turma=' || r.turma_id);
      else
        perform public.notificar(m.aluno_id, 'exercicio_liberado', r.quantos || ' exercícios novos',
          'A professora liberou novos exercícios do curso para a turma.', '/aluno/turmas/' || r.turma_id || '?aba=exercicios');
      end if;
    end loop;
  end loop;
  return null;
end;
$$;
revoke execute on function public.notificar_exercicios_do_curso() from public, anon, authenticated;
create trigger notificar_exercicios_do_curso after insert on public.curso_listas_liberadas
  referencing new table as novas
  for each statement execute function public.notificar_exercicios_do_curso();
