-- Aulas ao vivo: o link fixo da reunião (Google Meet) e os horários de cada turma, para o aluno entrar pela plataforma.
--
-- Fica numa tabela à parte (e não em "turmas") porque quem ainda está com o pedido pendente vê o nome da turma,
-- mas não pode ver o link da aula. Só a equipe da turma e os alunos aprovados leem.
--
-- horarios: [{"dia": 0-6 (0 = domingo), "inicio": "19:00", "fim": "20:00"}], no horário de Brasília.
-- aviso: recado do dia ("Hoje a aula começa às 20h"), que some sozinho depois de aviso_ate (se preenchido).

create table public.turma_encontros (
  turma_id uuid primary key references public.turmas (id) on delete cascade,
  link text not null default '' check (link = '' or link ~* '^https://'),
  horarios jsonb not null default '[]' check (jsonb_typeof(horarios) = 'array'),
  aviso text not null default '',
  aviso_ate date,
  atualizado_em timestamptz not null default now()
);

alter table public.turma_encontros enable row level security;
create policy "turma vê o link da aula ao vivo" on public.turma_encontros
  for select to authenticated using (public.gerencia_turma(turma_id) or public.aluno_da_turma(turma_id));
create policy "professor define o link" on public.turma_encontros
  for insert to authenticated with check (public.gerencia_turma(turma_id));
create policy "professor muda o link" on public.turma_encontros
  for update to authenticated using (public.gerencia_turma(turma_id)) with check (public.gerencia_turma(turma_id));
create policy "professor tira o link" on public.turma_encontros
  for delete to authenticated using (public.gerencia_turma(turma_id));

grant select, insert, delete on public.turma_encontros to authenticated;
grant update (link, horarios, aviso, aviso_ate, atualizado_em) on public.turma_encontros to authenticated;
