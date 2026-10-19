-- Bloqueio de usuários pelo admin.
-- Quem está bloqueado continua conseguindo entrar e ler o próprio perfil (para a plataforma mostrar
-- "conta bloqueada"), mas perde tudo o mais: professor/admin perde os poderes; aluno não vê nem responde listas.
-- Rodar no Supabase: SQL Editor -> colar este arquivo -> Run (depois do 0006).

alter table public.perfis add column bloqueado boolean not null default false;

-- true quando o usuário logado existe e não está bloqueado.
create function public.ativo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.perfis where id = auth.uid() and not bloqueado)
$$;
grant execute on function public.ativo() to authenticated;

-- Papel só vale para quem não está bloqueado: todas as políticas que usam meu_papel/eh_equipe passam a negar.
create or replace function public.meu_papel()
returns public.papel
language sql
stable
security definer
set search_path = ''
as $$
  select papel from public.perfis where id = auth.uid() and not bloqueado
$$;

create or replace function public.eh_equipe()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select papel in ('admin', 'professor') from public.perfis where id = auth.uid() and not bloqueado), false)
$$;

-- Aluno bloqueado não vê listas publicadas (e por isso também não consegue enviar respostas).
create or replace function public.lista_visivel(lista uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.eh_equipe()
      or (public.ativo() and exists (select 1 from public.listas where id = lista and status = 'publicada'))
$$;

-- O mesmo para cursos, aulas e turmas (parte em espera, mas a regra já vale).
create or replace function public.aluno_da_turma(turma uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.ativo() and exists (select 1 from public.matriculas where turma_id = turma and aluno_id = auth.uid())
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
    where t.curso_id = curso and m.aluno_id = auth.uid()
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
    where l.aula_id = aula and m.aluno_id = auth.uid()
  )
$$;

-- Só um admin muda papel ou bloqueio, e nunca o próprio.
create or replace function public.proteger_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.email is distinct from old.email or new.id is distinct from old.id then
    raise exception 'O e-mail e o id do perfil não podem ser alterados.';
  end if;
  if new.papel is distinct from old.papel or new.bloqueado is distinct from old.bloqueado then
    if public.meu_papel() is distinct from 'admin' then
      raise exception 'Só um admin pode mudar papéis ou bloquear usuários.';
    end if;
    if new.id = auth.uid() then
      raise exception 'Um admin não pode mudar o próprio papel nem se bloquear.';
    end if;
  end if;
  return new;
end;
$$;

grant update (bloqueado) on public.perfis to authenticated;
