-- Aulas com material em PDF (arquivo enviado ou link) e exercícios ligados a cada aula.
-- Rodar no Supabase: SQL Editor -> colar este arquivo -> Run (depois do 0008).

-- Material enviado: caminho no bucket "materiais" e o nome original do arquivo (o link externo continua em material_url).
alter table public.aulas add column material_arquivo text not null default '';
alter table public.aulas add column material_nome text not null default '';
grant update (material_arquivo, material_nome) on public.aulas to authenticated;

-- Bucket PRIVADO: o material é da escola ("proibida a comercialização"). O site lê por link assinado e temporário.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materiais', 'materiais', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

create policy "equipe envia materiais" on storage.objects
  for insert to authenticated with check (bucket_id = 'materiais' and public.eh_equipe());
create policy "equipe substitui materiais" on storage.objects
  for update to authenticated
  using (bucket_id = 'materiais' and public.eh_equipe())
  with check (bucket_id = 'materiais' and public.eh_equipe());
create policy "equipe apaga materiais" on storage.objects
  for delete to authenticated using (bucket_id = 'materiais' and public.eh_equipe());
-- Leitura: a equipe lê tudo; o aluno só o PDF de uma aula liberada para a turma dele.
create policy "ler materiais das aulas visíveis" on storage.objects
  for select to authenticated using (
    bucket_id = 'materiais' and (
      public.eh_equipe()
      or exists (select 1 from public.aulas a where a.material_arquivo = name and public.aluno_ve_aula(a.id))
    )
  );

-- Exercícios que aparecem no fim da aula ("Hora de praticar!"). Uma lista pode estar em várias aulas.
create table public.aula_listas (
  aula_id uuid not null references public.aulas (id) on delete cascade,
  lista_id uuid not null references public.listas (id) on delete cascade,
  ordem integer not null default 0,
  primary key (aula_id, lista_id)
);
create index aula_listas_lista on public.aula_listas (lista_id);

alter table public.aula_listas enable row level security;
create policy "equipe e alunos da aula veem os exercícios dela" on public.aula_listas
  for select to authenticated using (public.eh_equipe() or public.aluno_ve_aula(aula_id));
create policy "equipe liga exercícios" on public.aula_listas
  for insert to authenticated with check (public.eh_equipe());
create policy "equipe reordena exercícios" on public.aula_listas
  for update to authenticated using (public.eh_equipe()) with check (public.eh_equipe());
create policy "equipe desliga exercícios" on public.aula_listas
  for delete to authenticated using (public.eh_equipe());

grant select, insert, delete on public.aula_listas to authenticated;
grant update (ordem) on public.aula_listas to authenticated;
