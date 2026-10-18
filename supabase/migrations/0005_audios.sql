-- Áudios de listening: bucket no Storage, configuração do TTS e cota separada para áudio.
-- Rodar no Supabase: SQL Editor -> colar este arquivo -> Run (depois do 0004).

-- Bucket público para leitura: o aluno toca o MP3 pelo link. Os nomes são o hash do roteiro,
-- então não dá para adivinhar links; e o conteúdo é material de aula, não dado pessoal.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audios', 'audios', true, 15728640, array['audio/mpeg'])
on conflict (id) do nothing;

create policy "equipe envia áudios" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'audios' and public.eh_equipe());
create policy "equipe substitui áudios" on storage.objects
  for update to authenticated
  using (bucket_id = 'audios' and public.eh_equipe())
  with check (bucket_id = 'audios' and public.eh_equipe());
create policy "equipe apaga áudios" on storage.objects
  for delete to authenticated
  using (bucket_id = 'audios' and public.eh_equipe());

-- Modelo de voz e limite diário de áudios por professor.
insert into public.config_ia (habilidade, provedor, modelo, limite_diario)
values ('gerar_audio', 'gemini', 'gemini-3.8-flash-tts', 10)
on conflict (habilidade) do nothing;

-- A cota passa a ser contada por habilidade (listas e áudios têm limites separados).
-- O padrão continua 'gerar_lista', então a função "assistente" já publicada segue funcionando sem mudança.
drop function public.geracoes_hoje();
create function public.geracoes_hoje(habilidade_pedida text default 'gerar_lista')
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.geracoes_ia
  where professor_id = auth.uid()
    and ok
    and habilidade = habilidade_pedida
    and criado_em >= (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')
$$;
grant execute on function public.geracoes_hoje(text) to authenticated;
