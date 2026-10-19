-- Corrige o envio de áudios: o upload com substituição (upsert) do Storage precisa que quem envia
-- também possa ler os objetos do bucket pela API. Sem esta política o envio falhava com
-- "new row violates row-level security policy" (visto em 19/10/2026).
-- O aluno continua tocando o áudio pelo link público do bucket; esta leitura pela API é só da equipe.
-- Rodar no Supabase: SQL Editor -> colar este arquivo -> Run (depois do 0005).

create policy "equipe lê áudios" on storage.objects
  for select to authenticated
  using (bucket_id = 'audios' and public.eh_equipe());
