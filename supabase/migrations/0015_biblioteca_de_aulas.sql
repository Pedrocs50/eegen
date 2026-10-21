-- Biblioteca de aulas em PDF: os slides ficam guardados uma vez, com título, idioma e nível, e qualquer curso
-- pode usar o mesmo PDF numa aula (sem subir de novo e sem procurar no Drive).
--
-- O arquivo continua no bucket privado "materiais". A aula guarda o caminho dele (aulas.material_arquivo), como já fazia:
-- por isso a regra que deixa o aluno abrir o PDF da aula liberada não muda. A biblioteca só cataloga os arquivos.
-- Só a equipe vê a biblioteca; o aluno só chega ao PDF pela aula liberada para a turma dele.

create table public.materiais (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(trim(titulo)) > 0),
  idioma public.idioma not null,
  -- Nulo = ainda sem nível definido (os nomes dos arquivos costumam não dizer o nível).
  nivel smallint check (nivel between 1 and 6),
  -- Caminho do arquivo no bucket "materiais".
  arquivo text not null unique,
  nome_original text not null default '',
  tamanho bigint not null default 0,
  criado_por uuid default auth.uid() references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index materiais_idioma_nivel on public.materiais (idioma, nivel);

alter table public.materiais enable row level security;
create policy "equipe vê a biblioteca" on public.materiais
  for select to authenticated using (public.eh_equipe());
create policy "equipe adiciona à biblioteca" on public.materiais
  for insert to authenticated with check (public.eh_equipe());
create policy "equipe edita a biblioteca" on public.materiais
  for update to authenticated using (public.eh_equipe()) with check (public.eh_equipe());
create policy "equipe tira da biblioteca" on public.materiais
  for delete to authenticated using (public.eh_equipe());

grant select, insert, delete on public.materiais to authenticated;
grant update (titulo, idioma, nivel) on public.materiais to authenticated;

-- Um PDF que alguma aula usa não pode sair da biblioteca (e, com ele, do bucket): a aula perderia o material.
create function public.proteger_material_em_uso()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  em_uso integer;
begin
  select count(*) into em_uso from public.aulas where material_arquivo = old.arquivo;
  if em_uso > 0 then
    raise exception 'Este PDF está em uso por % %. Tire-o das aulas antes de apagar.', em_uso, case when em_uso = 1 then 'aula' else 'aulas' end;
  end if;
  return old;
end;
$$;
create trigger proteger_material_em_uso before delete on public.materiais
  for each row execute function public.proteger_material_em_uso();
revoke execute on function public.proteger_material_em_uso() from public, anon, authenticated;

-- PDFs que já estavam nas aulas entram na biblioteca (idioma e nível vêm do curso).
insert into public.materiais (titulo, idioma, nivel, arquivo, nome_original)
select distinct on (a.material_arquivo)
  coalesce(nullif(trim(regexp_replace(a.material_nome, '\.pdf$', '', 'i')), ''), a.titulo),
  c.idioma, c.nivel, a.material_arquivo, a.material_nome
from public.aulas a
join public.cursos c on c.id = a.curso_id
where a.material_arquivo <> ''
order by a.material_arquivo, a.numero
on conflict (arquivo) do nothing;
