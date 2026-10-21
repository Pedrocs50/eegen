-- Ajustes para a professora montar tudo de uma vez (criar turma e abrir, liberar vários exercícios e aulas).
--
-- 1. A professora enxerga a turma que ela mesma acabou de criar no próprio comando de criar (INSERT ... RETURNING).
--    Antes só o admin conseguia: a regra de leitura passava por uma função que não "vê" a linha nova. Sem isso,
--    qualquer tela que crie a turma e já abra a página dela dava erro para a professora (e cancelava a criação).
-- 2. Liberar várias aulas ou vários exercícios extras de uma vez gera UM aviso por aluno ("5 exercícios extras novos"),
--    em vez de um aviso por item.

-- ---------------------------------------------------------------------------
-- 1. Leitura da própria turma
-- ---------------------------------------------------------------------------
drop policy "professor vê as suas turmas; aluno as em que está" on public.turmas;
create policy "professor vê as suas turmas; aluno as em que está" on public.turmas
  for select to authenticated
  using ((professor_id = auth.uid() and public.eh_equipe()) or public.gerencia_turma(id) or public.inscrito_na_turma(id));

-- ---------------------------------------------------------------------------
-- 2. Avisos agrupados por comando
-- ---------------------------------------------------------------------------
drop trigger notificar_extra on public.turma_listas;
drop function public.notificar_extra();

create function public.notificar_extras()
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
        perform public.notificar(m.aluno_id, 'extra_liberado', 'Exercício extra: ' || r.titulo,
          'A professora liberou um exercício extra para a turma.', '/praticar/' || r.id_lista || '?turma=' || r.turma_id);
      else
        perform public.notificar(m.aluno_id, 'extra_liberado', r.quantos || ' exercícios extras novos',
          'A professora liberou novos exercícios extras para a turma.', '/aluno/turmas/' || r.turma_id || '?aba=exercicios');
      end if;
    end loop;
  end loop;
  return null;
end;
$$;
create trigger notificar_extras after insert on public.turma_listas
  referencing new table as novas
  for each statement execute function public.notificar_extras();

drop trigger notificar_aula_liberada on public.aulas_liberadas;
drop function public.notificar_aula_liberada();

create function public.notificar_aulas_liberadas()
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
    select n.turma_id, count(*) as quantas, min(a.numero) as numero, min(a.titulo) as titulo, min(a.subtitulo) as subtitulo, min(a.id::text)::uuid as id_aula
    from novas n join public.aulas a on a.id = n.aula_id
    group by n.turma_id
  loop
    for m in select aluno_id from public.matriculas where turma_id = r.turma_id and situacao = 'aprovada' loop
      if r.quantas = 1 then
        perform public.notificar(m.aluno_id, 'aula_liberada', 'Aula ' || r.numero || ' liberada: ' || r.titulo,
          coalesce(nullif(r.subtitulo, ''), 'O material e os exercícios da aula já estão disponíveis.'), '/aulas/' || r.id_aula || '?turma=' || r.turma_id);
      else
        perform public.notificar(m.aluno_id, 'aula_liberada', r.quantas || ' aulas liberadas',
          'A professora liberou novas aulas para a turma.', '/aluno/turmas/' || r.turma_id || '?aba=aulas');
      end if;
    end loop;
  end loop;
  return null;
end;
$$;
create trigger notificar_aulas_liberadas after insert on public.aulas_liberadas
  referencing new table as novas
  for each statement execute function public.notificar_aulas_liberadas();

revoke execute on function public.notificar_extras() from public, anon, authenticated;
revoke execute on function public.notificar_aulas_liberadas() from public, anon, authenticated;
