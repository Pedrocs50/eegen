-- Assistente de IA: qual provedor e modelo cada habilidade usa, histórico de gerações e cota por professor.
-- Rodar no Supabase: SQL Editor -> colar este arquivo -> Run (depois do 0003).

create table public.config_ia (
  habilidade text primary key,
  provedor text not null check (provedor in ('gemini', 'groq')),
  modelo text not null,
  limite_diario integer not null default 30 check (limite_diario >= 0),
  atualizado_em timestamptz not null default now()
);

insert into public.config_ia (habilidade, provedor, modelo, limite_diario)
values ('gerar_lista', 'gemini', 'gemini-flash-latest', 30);

create table public.geracoes_ia (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  habilidade text not null,
  provedor text not null,
  modelo text not null,
  pedido text not null default '',
  ok boolean not null,
  erro text not null default '',
  tokens_entrada integer not null default 0,
  tokens_saida integer not null default 0,
  segundos numeric not null default 0,
  criado_em timestamptz not null default now()
);
create index geracoes_professor_dia on public.geracoes_ia (professor_id, criado_em);

-- Quantas gerações o professor logado já fez hoje (fuso de Brasília), para a cota.
create function public.geracoes_hoje()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.geracoes_ia
  where professor_id = auth.uid()
    and ok
    and criado_em >= (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')
$$;

alter table public.config_ia enable row level security;
alter table public.geracoes_ia enable row level security;

create policy "equipe lê a configuração de IA" on public.config_ia
  for select to authenticated using (public.eh_equipe());
create policy "admin muda a configuração de IA" on public.config_ia
  for update to authenticated using (public.meu_papel() = 'admin') with check (public.meu_papel() = 'admin');

create policy "professor registra as próprias gerações" on public.geracoes_ia
  for insert to authenticated with check (professor_id = auth.uid() and public.eh_equipe());
create policy "professor vê as próprias gerações; admin vê todas" on public.geracoes_ia
  for select to authenticated using (professor_id = auth.uid() or public.meu_papel() = 'admin');

grant select on public.config_ia to authenticated;
grant update (provedor, modelo, limite_diario) on public.config_ia to authenticated;
grant select, insert on public.geracoes_ia to authenticated;
grant execute on function public.geracoes_hoje() to authenticated;
