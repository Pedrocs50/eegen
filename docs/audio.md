# Áudio dos listenings (Gemini TTS)

O professor escreve, ou pede ao Assistente UP, um roteiro de diálogo. A plataforma gera a voz com o TTS oficial do Gemini (plano grátis), e o aluno ouve com controle de velocidade.

## Como funciona
```
Editor (seção "Áudio")                     Edge Function "audio"                 Gemini TTS
  roteiro "NOME: fala" + voz por falante ─►  login + papel + cota do dia   ─►  gemini-3.8-flash-tts
  confere o cache (hash do conteúdo)        até 2 falantes = 1 pedido            (reserva: ...-lite-tts)
  ◄─ WAV (PCM 24 kHz) ───────────────────── fade nas pontas + respiro inicial
  converte em MP3 (lamejs, no navegador)
  envia ao Storage: audios/<hash>.mp3 ─► o aluno toca pelo link público
```
- **Vozes:** 30 vozes do Gemini, com gênero e estilo, em `plataforma/src/lib/vozes.ts`. A plataforma escolhe sozinha pelo gênero que o assistente indica (`"vozes": {"ANNA": "feminina"}`) e o professor pode trocar.
- **Cache:** o nome do arquivo é o hash de roteiro + vozes. Gerar de novo a mesma coisa reaproveita o arquivo e não gasta cota.
- **Desatualizado:** se o roteiro ou as vozes mudarem depois de gerar, o editor avisa e não deixa publicar até gerar de novo.
- **Para o aluno:**
  - player com 0,75×, 1× e 1,25×;
  - transcrição "depois de enviar" (padrão), "a qualquer momento" ou "nunca".
  - O roteiro chega ao navegador do aluno junto com a lista. Um aluno curioso conseguiria lê-lo pelas ferramentas do navegador, mesmo quando a transcrição está escondida.

## Limites do plano grátis (medidos em 18/10/2026)
| Limite | Valor |
|---|---|
| Pedidos de voz por minuto, por modelo | 3 |
| Pedidos de voz por dia, por modelo, para o projeto inteiro | 10 |
| Falantes por pedido | 2 |

Consequências:
- **Até 2 falantes por áudio.** Com 3 ou mais, dividir em pedidos fez o modelo trocar a voz de um falante entre um trecho e outro, e ainda gastava a cota de minuto. A plataforma recusa e sugere dividir a conversa em duas seções.
- **Modelo de reserva automático:** quando `gemini-3.8-flash-tts` esgota no dia, a função usa `gemini-3.8-flash-lite-tts`, que tem cota própria. São cerca de **20 áudios por dia para a escola**.
- **Limite por professor** (`config_ia`, habilidade `gerar_audio`): 10 por dia, ajustável em **Usuários → Voz dos listenings**.
- Se a escola precisar de mais, o plano pago do Gemini aumenta os limites sem mudar o código.

## Testes feitos
- **Gemini 3.8 TTS com o roteiro B1_01:** Leo com voz masculina americana e Priya feminina britânica; fala clara, sem cortes (conferido transcrevendo o áudio com o próprio Gemini).
- **Função completa** (Supabase simulado): 2 falantes em 5 s; 1 falante em 4 s; 3 falantes recusado; voz inválida e roteiro sem falante recusados.
- **Fluxo completo:** o assistente criou um listening de hotel (A2) com gêneros → a importação escolheu Kore e Puck → a função gerou 39 s de áudio com o modelo de reserva (o principal tinha esgotado nos testes).
- **MP3 no navegador:** 30 s de áudio viram 234 KB em ~0,5 s.
- **Em produção (19/10/2026):** o Assistente UP escreveu o listening "Checking in at the Grand Hotel", e a plataforma gerou e salvou 38 s de áudio no bucket. O professor ouviu no editor.

## Como publicar
1. **SQL Editor** → rodar `supabase/migrations/0005_audios.sql` e depois `0006_leitura_audios.sql` (permissão de leitura que o upload com substituição exige). Ele cria o bucket `audios`, as permissões, a configuração de voz e a cota por habilidade.
2. **Edge Functions → Deploy a new function → Via Editor**:
   - nome **`audio`**;
   - colar `supabase/functions/audio/index.ts`;
   - **Deploy**.
   - Depois, em **Settings**, **desligar "Verify JWT with legacy secret"** e salvar, como no assistente.
3. Republicar a função **`assistente`**: abrir a função → aba **Code** → colar o novo `supabase/functions/assistente/index.ts` → **Deploy**. Isso faz o assistente criar listenings.
4. O segredo `GEMINI_API_KEY` já existe e serve para as duas funções.
