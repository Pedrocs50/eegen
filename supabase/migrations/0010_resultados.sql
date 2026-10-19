-- Resultados para a equipe: quem fez cada lista, as notas e as questões em que os alunos mais erram.
--
-- Duas funções que já devolvem tudo agregado num único JSON. Assim a tela não esbarra no limite de
-- 1000 linhas da API, e o professor vê o nome dos alunos que responderam mesmo sem turma em comum
-- (a regra de leitura de perfis continua igual).
-- Por padrão, as tentativas feitas por admins e professores (testes) ficam de fora.

-- Tentativa conta nos resultados? (alunos sempre; equipe só quando pedido)
create function public.conta_no_resultado(id_aluno uuid, incluir_equipe boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select incluir_equipe or coalesce((select p.papel = 'aluno' from public.perfis p where p.id = id_aluno), false);
$$;

-- Visão geral: tentativas, acerto por habilidade e os alunos envolvidos, a partir de uma data (ou tudo).
create function public.resultados_equipe(desde timestamptz default null, incluir_equipe boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.eh_equipe() then
    raise exception 'Só professores e admins veem os resultados.';
  end if;

  return jsonb_build_object(
    'tentativas', coalesce((
      select jsonb_agg(jsonb_build_object('lista', t.lista_id, 'aluno', t.aluno_id, 'nota', t.nota, 'em', t.enviada_em) order by t.enviada_em)
      from public.tentativas t
      where (desde is null or t.enviada_em >= desde) and public.conta_no_resultado(t.aluno_id, incluir_equipe)
    ), '[]'),
    'habilidades', coalesce((
      select jsonb_agg(jsonb_build_object('lista', x.lista_id, 'aluno', x.aluno_id, 'habilidade', x.habilidade, 'acertos', x.acertos, 'total', x.total))
      from (
        select t.lista_id, t.aluno_id, q.habilidade, sum(r.fracao) as acertos, count(*) as total
        from public.respostas r
        join public.tentativas t on t.id = r.tentativa_id
        join public.questoes q on q.id = r.questao_id
        where (desde is null or t.enviada_em >= desde) and public.conta_no_resultado(t.aluno_id, incluir_equipe)
        group by t.lista_id, t.aluno_id, q.habilidade
      ) x
    ), '[]'),
    'alunos', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'email', p.email, 'papel', p.papel) order by p.nome)
      from public.perfis p
      where exists (select 1 from public.tentativas t where t.aluno_id = p.id)
        and public.conta_no_resultado(p.id, incluir_equipe)
    ), '[]')
  );
end;
$$;

-- Uma lista: cada questão com a taxa de acerto e as respostas erradas mais comuns, e as tentativas de cada aluno.
create function public.resultados_lista(id_lista uuid, incluir_equipe boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.eh_equipe() then
    raise exception 'Só professores e admins veem os resultados.';
  end if;

  return jsonb_build_object(
    'questoes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'secao', s.titulo, 'enunciado', q.enunciado, 'formato', q.formato, 'habilidade', q.habilidade,
        'conteudo', q.conteudo, 'gabarito', coalesce(g.gabarito, '{}'),
        'respostas', est.respostas, 'acerto', est.acerto,
        'erradas', coalesce((
          select jsonb_agg(jsonb_build_object('resposta', e.resposta, 'vezes', e.vezes) order by e.vezes desc)
          from (
            select r.resposta, count(*) as vezes
            from public.respostas r join public.tentativas t on t.id = r.tentativa_id
            where r.questao_id = q.id and r.fracao < 1 and r.resposta <> '{}'::jsonb
              and public.conta_no_resultado(t.aluno_id, incluir_equipe)
            group by r.resposta
            order by count(*) desc
            limit 3
          ) e
        ), '[]')
      ) order by s.ordem, q.ordem)
      from public.questoes q
      join public.secoes s on s.id = q.secao_id
      left join public.gabaritos g on g.questao_id = q.id
      cross join lateral (
        select count(*) as respostas, avg(r.fracao) as acerto
        from public.respostas r join public.tentativas t on t.id = r.tentativa_id
        where r.questao_id = q.id and public.conta_no_resultado(t.aluno_id, incluir_equipe)
      ) est
      where q.lista_id = id_lista
    ), '[]'),
    'tentativas', coalesce((
      select jsonb_agg(jsonb_build_object('aluno', t.aluno_id, 'nota', t.nota, 'em', t.enviada_em) order by t.enviada_em)
      from public.tentativas t
      where t.lista_id = id_lista and public.conta_no_resultado(t.aluno_id, incluir_equipe)
    ), '[]'),
    'alunos', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'email', p.email, 'papel', p.papel) order by p.nome)
      from public.perfis p
      where exists (select 1 from public.tentativas t where t.aluno_id = p.id and t.lista_id = id_lista)
        and public.conta_no_resultado(p.id, incluir_equipe)
    ), '[]')
  );
end;
$$;

-- Usada só por dentro das funções acima (que rodam como dono), então ninguém precisa chamá-la direto.
revoke execute on function public.conta_no_resultado(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.resultados_equipe(timestamptz, boolean) from public, anon;
revoke execute on function public.resultados_lista(uuid, boolean) from public, anon;
grant execute on function public.resultados_equipe(timestamptz, boolean) to authenticated;
grant execute on function public.resultados_lista(uuid, boolean) to authenticated;
