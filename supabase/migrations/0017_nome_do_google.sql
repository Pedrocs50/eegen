-- Login com Google: o perfil nasce com o nome que o Google informa.
--
-- O cadastro por e-mail manda o nome em "nome"; o Google manda em "full_name" (ou "name"). A função que cria o perfil
-- passa a aceitar os três, nessa ordem. O resto continua igual: o pedido de entrada na turma pelo código do cadastro.

create or replace function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  id_turma uuid;
  nome_perfil text;
begin
  nome_perfil := left(coalesce(
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'nome', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'name', '')), ''),
    ''
  ), 120);

  insert into public.perfis (id, nome, email)
  values (new.id, nome_perfil, new.email);

  select id into id_turma from public.turmas
  where codigo = upper(trim(coalesce(new.raw_user_meta_data ->> 'codigo_turma', ''))) and ativa;
  if id_turma is not null then
    insert into public.matriculas (turma_id, aluno_id) values (id_turma, new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;
