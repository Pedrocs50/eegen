-- Perfis de usuário e papéis (admin, professor, aluno).
-- Rodar no Supabase: SQL Editor -> colar este arquivo -> Run.

create type public.papel as enum ('admin', 'professor', 'aluno');

create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '',
  email text not null,
  papel public.papel not null default 'aluno',
  criado_em timestamptz not null default now()
);

alter table public.perfis enable row level security;

-- Papel de quem está logado. "security definer" evita recursão nas políticas abaixo.
create function public.meu_papel()
returns public.papel
language sql
stable
security definer
set search_path = ''
as $$
  select papel from public.perfis where id = auth.uid()
$$;

-- Todo cadastro novo vira aluno. Admin e professor só por promoção de um admin.
create function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, nome, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nome', ''), new.email);
  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();

-- Ninguém muda o próprio papel nem o e-mail pela API; só um admin muda papéis.
-- (No SQL Editor auth.uid() é nulo, então lá o dono do banco pode tudo.)
create function public.proteger_perfil()
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
  if new.papel is distinct from old.papel then
    if public.meu_papel() is distinct from 'admin' then
      raise exception 'Só um admin pode mudar papéis.';
    end if;
    if new.id = auth.uid() then
      raise exception 'Um admin não pode mudar o próprio papel.';
    end if;
  end if;
  return new;
end;
$$;

create trigger proteger_perfil
  before update on public.perfis
  for each row execute function public.proteger_perfil();

create policy "ver o próprio perfil" on public.perfis
  for select to authenticated
  using (id = auth.uid());

create policy "admin vê todos os perfis" on public.perfis
  for select to authenticated
  using (public.meu_papel() = 'admin');

create policy "editar o próprio perfil" on public.perfis
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "admin edita perfis" on public.perfis
  for update to authenticated
  using (public.meu_papel() = 'admin')
  with check (public.meu_papel() = 'admin');

-- "Automatically expose new tables" está desligado: liberar só o necessário.
grant usage on schema public to authenticated;
grant select, update (nome, papel) on public.perfis to authenticated;
grant execute on function public.meu_papel() to authenticated;
revoke execute on function public.criar_perfil() from public, anon, authenticated;
revoke execute on function public.proteger_perfil() from public, anon, authenticated;
