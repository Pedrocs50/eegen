-- Notificações dentro da plataforma (o sininho do menu). Cada pessoa escolhe quais quer receber.
--
-- Para a equipe (professor/admin, das próprias turmas):
--   pedido_entrada   aluno pediu para entrar numa turma           (ligada por padrão)
--   nota_baixa       aluno da turma tirou menos de 60% numa lista  (ligada por padrão)
--   exercicio_feito  aluno da turma enviou um exercício           (desligada: seriam muitas)
-- Para o aluno:
--   entrada_aprovada  a professora aprovou a entrada na turma
--   aula_liberada     aula nova liberada na turma
--   extra_liberado    exercício extra novo na turma
--
-- As notificações nascem por gatilhos no banco: não dependem de a professora estar com o site aberto.

create table public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  para uuid not null references public.perfis (id) on delete cascade,
  tipo text not null,
  titulo text not null,
  texto text not null default '',
  link text not null default '',
  criada_em timestamptz not null default now(),
  lida_em timestamptz
);
create index notificacoes_para on public.notificacoes (para, criada_em desc);

alter table public.notificacoes enable row level security;
create policy "cada um vê as suas notificações" on public.notificacoes
  for select to authenticated using (para = auth.uid());
create policy "cada um marca as suas como lidas" on public.notificacoes
  for update to authenticated using (para = auth.uid()) with check (para = auth.uid());
create policy "cada um apaga as suas" on public.notificacoes
  for delete to authenticated using (para = auth.uid());
grant select, delete on public.notificacoes to authenticated;
grant update (lida_em) on public.notificacoes to authenticated;

-- Preferências: {"tipo": true|false}. O que não estiver aqui segue o padrão de quer_notificacao.
alter table public.perfis add column preferencias_notificacao jsonb not null default '{}';
grant update (preferencias_notificacao) on public.perfis to authenticated;

create function public.quer_notificacao(pessoa uuid, tipo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select (p.preferencias_notificacao ->> tipo)::boolean from public.perfis p where p.id = pessoa and not p.bloqueado),
    tipo <> 'exercicio_feito'
  ) and exists (select 1 from public.perfis p where p.id = pessoa and not p.bloqueado)
$$;

create function public.notificar(pessoa uuid, tipo text, titulo text, texto text, link text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pessoa is not null and public.quer_notificacao(pessoa, tipo) then
    insert into public.notificacoes (para, tipo, titulo, texto, link) values (pessoa, tipo, titulo, texto, link);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Gatilhos
-- ---------------------------------------------------------------------------

-- Pedido para entrar → professora da turma. Aprovação → aluno.
create function public.notificar_matricula()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
  nome_aluno text;
begin
  select id, nome, professor_id into t from public.turmas where id = new.turma_id;
  if tg_op = 'INSERT' and new.situacao = 'pendente' then
    select coalesce(nullif(nome, ''), email) into nome_aluno from public.perfis where id = new.aluno_id;
    perform public.notificar(t.professor_id, 'pedido_entrada', 'Pedido para entrar na turma',
      nome_aluno || ' pediu para entrar na turma ' || t.nome || '.', '/turmas/' || t.id || '?aba=alunos');
  elsif tg_op = 'UPDATE' and old.situacao = 'pendente' and new.situacao = 'aprovada' then
    perform public.notificar(new.aluno_id, 'entrada_aprovada', 'Você entrou na turma ' || t.nome,
      'A professora aprovou a sua entrada. As aulas e os exercícios da turma já aparecem para você.', '/aluno?turma=' || t.id);
  end if;
  return new;
end;
$$;
create trigger notificar_matricula after insert or update of situacao on public.matriculas
  for each row execute function public.notificar_matricula();

-- Aula liberada → alunos aprovados da turma.
create function public.notificar_aula_liberada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  m record;
begin
  select id, numero, titulo, subtitulo into a from public.aulas where id = new.aula_id;
  for m in select aluno_id from public.matriculas where turma_id = new.turma_id and situacao = 'aprovada' loop
    perform public.notificar(m.aluno_id, 'aula_liberada', 'Aula ' || a.numero || ' liberada: ' || a.titulo,
      coalesce(nullif(a.subtitulo, ''), 'O material e os exercícios da aula já estão disponíveis.'), '/aulas/' || a.id);
  end loop;
  return new;
end;
$$;
create trigger notificar_aula_liberada after insert on public.aulas_liberadas
  for each row execute function public.notificar_aula_liberada();

-- Exercício extra (publicado) → alunos aprovados da turma.
create function public.notificar_extra()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  l record;
  m record;
begin
  select id, titulo, status into l from public.listas where id = new.lista_id;
  if l.status <> 'publicada' then
    return new;
  end if;
  for m in select aluno_id from public.matriculas where turma_id = new.turma_id and situacao = 'aprovada' loop
    perform public.notificar(m.aluno_id, 'extra_liberado', 'Exercício extra: ' || l.titulo,
      'A professora liberou um exercício extra para a turma.', '/praticar/' || l.id);
  end loop;
  return new;
end;
$$;
create trigger notificar_extra after insert on public.turma_listas
  for each row execute function public.notificar_extra();

-- Exercício enviado (a nota é gravada logo depois de criar a tentativa) → professoras das turmas do aluno.
create function public.notificar_tentativa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  nome_aluno text;
  titulo_lista text;
  professora uuid;
begin
  if old.total > 0 or new.total = 0 then
    return new;
  end if;
  if (select papel from public.perfis where id = new.aluno_id) <> 'aluno' then
    return new;
  end if;
  select coalesce(nullif(nome, ''), email) into nome_aluno from public.perfis where id = new.aluno_id;
  select titulo into titulo_lista from public.listas where id = new.lista_id;
  for professora in
    select distinct t.professor_id from public.matriculas m join public.turmas t on t.id = m.turma_id
    where m.aluno_id = new.aluno_id and m.situacao = 'aprovada'
  loop
    if new.nota < 60 and public.quer_notificacao(professora, 'nota_baixa') then
      perform public.notificar(professora, 'nota_baixa', nome_aluno || ' tirou ' || round(new.nota) || '%',
        'Em "' || titulo_lista || '". Veja onde errou.', '/resultados/alunos/' || new.aluno_id);
    else
      perform public.notificar(professora, 'exercicio_feito', nome_aluno || ' fez um exercício',
        '"' || titulo_lista || '": ' || round(new.nota) || '%.', '/resultados/alunos/' || new.aluno_id);
    end if;
  end loop;
  return new;
end;
$$;
create trigger notificar_tentativa after update of total on public.tentativas
  for each row execute function public.notificar_tentativa();

revoke execute on function public.quer_notificacao(uuid, text) from public, anon, authenticated;
revoke execute on function public.notificar(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.notificar_matricula() from public, anon, authenticated;
revoke execute on function public.notificar_aula_liberada() from public, anon, authenticated;
revoke execute on function public.notificar_extra() from public, anon, authenticated;
revoke execute on function public.notificar_tentativa() from public, anon, authenticated;
