-- Registro de exclusões: tudo o que for apagado de cursos, turmas, aulas e matrículas fica anotado (o que era, quando,
-- quem pediu e por onde), com uma cópia do conteúdo, para poder explicar e restaurar.
--
-- Criado para investigar cursos e turmas que "sumiam": sem esse registro, uma linha apagada não deixa rastro.
-- Só o admin lê. Ninguém grava aqui pela API: só o gatilho.

create table public.registro_exclusoes (
  id uuid primary key default gen_random_uuid(),
  tabela text not null,
  -- Cópia completa da linha apagada (dá para recriá-la a partir daqui).
  linha jsonb not null,
  -- Quem pediu: o usuário logado (nulo quando vem do SQL Editor do Supabase, que não tem usuário).
  por uuid,
  -- Por onde: "DELETE /cursos" quando veio do site, "SQL direto" quando veio do SQL Editor; no apagar em cascata,
  -- cada linha que sumiu junto tem o seu registro.
  via text not null default 'SQL direto',
  em timestamptz not null default now()
);
create index registro_exclusoes_em on public.registro_exclusoes (em desc);

alter table public.registro_exclusoes enable row level security;
create policy "só o admin lê o registro de exclusões" on public.registro_exclusoes
  for select to authenticated using (public.meu_papel() = 'admin');
grant select on public.registro_exclusoes to authenticated;

create function public.registrar_exclusao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.registro_exclusoes (tabela, linha, por, via)
  values (
    tg_table_name,
    to_jsonb(old),
    auth.uid(),
    coalesce(nullif(trim(coalesce(current_setting('request.method', true), '') || ' ' || coalesce(current_setting('request.path', true), '')), ''), 'SQL direto')
  );
  return old;
end;
$$;
revoke execute on function public.registrar_exclusao() from public, anon, authenticated;

create trigger registrar_exclusao after delete on public.cursos for each row execute function public.registrar_exclusao();
create trigger registrar_exclusao after delete on public.turmas for each row execute function public.registrar_exclusao();
create trigger registrar_exclusao after delete on public.aulas for each row execute function public.registrar_exclusao();
create trigger registrar_exclusao after delete on public.matriculas for each row execute function public.registrar_exclusao();
