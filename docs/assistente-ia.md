# Assistente UP (IA dentro da plataforma)

O professor pede os exercícios em uma frase, no editor da lista, e recebe a lista pronta no padrão da escola para revisar. Funciona com a conta de professor da própria plataforma: ninguém precisa de conta de IA.

## Como funciona
```
Editor (chat)  ──►  Edge Function "assistente"  ──►  Gemini (grátis) ou Groq
                     │ confere login e papel (professor/admin)
                     │ confere a cota do dia (config_ia.limite_diario)
                     │ monta a "base sólida":
                     │   regras de ensino da escola
                     │   + exemplos fixos tirados das aulas da Monique
                     │   + as 2 listas publicadas mais recentes do mesmo idioma
                     │ conserta e valida o JSON (pede de novo uma vez se vier errado)
                     └ registra a geração em geracoes_ia (tempo, tokens, erro)
```
- **Conversa:** a resposta do assistente volta para ele como JSON, então dá para pedir ajustes ("troque as lacunas por lacunas com opções").
- **Qual IA:** o provedor e o modelo ficam na tabela `config_ia`, que o admin muda em **Usuários → Assistente de IA**. Padrão: Gemini, `gemini-flash-latest`, 30 pedidos por professor por dia.
- **Código:** a função está em [`supabase/functions/assistente/index.ts`](../supabase/functions/assistente/index.ts), num arquivo só e sem dependências. A tabela de configuração e o histórico estão na migração [`0004_assistente_ia.sql`](../supabase/migrations/0004_assistente_ia.sql).

## Testes feitos (18/10/2026)
- **Modelos do Gemini com o pedido da escola**, cada lista validada pelo conversor da plataforma:
  - `gemini-flash-latest`: ~30 s, 15 questões, zero pendências.
  - `gemini-3.8-flash`: ~40 s, mesma qualidade.
  - `gemini-3.5-flash-lite`: ~6 s, mas gerou uma questão com o verbo faltando.
- **Espanhol** (demonstrativos e advérbios de lugar): acentos corretos e contexto profissional.
- **Função completa**, com o Supabase simulado e o Gemini de verdade:
  - pedido e ajuste em dois turnos, 16 s e 10 s, sem pendências;
  - registro das gerações;
  - bloqueio de quem não é professor.
- **Migração 0004:** testada no PGlite (cota, permissões, aluno sem acesso).

## Como publicar (uma vez)

### 1. Rodar a migração
No Supabase: **SQL Editor** → colar `supabase/migrations/0004_assistente_ia.sql` → **Run**.

### 2. Cadastrar a chave do Gemini como segredo
No Supabase: **Edge Functions → Secrets** (ou **Project Settings → Edge Functions**) → **Add new secret**:
- Name: `GEMINI_API_KEY`
- Value: a chave criada no Google AI Studio

A chave fica só no Supabase. Ela nunca vai para o site nem para o GitHub.

> A chave usada nos testes apareceu no histórico do chat. Por segurança, gere uma nova no AI Studio, cadastre a nova aqui e apague a antiga.

### 3. Publicar a função
**Opção A, pelo painel (sem instalar nada):**
1. **Edge Functions → Deploy a new function → Via Editor**.
2. Nome: `assistente`.
3. Apague o código de exemplo e cole todo o conteúdo de `supabase/functions/assistente/index.ts`.
4. **Deploy function**. Deixe a verificação de JWT ligada (o padrão).

**Opção B, pelo terminal:**
```bash
npx supabase login
```
```bash
npx supabase functions deploy assistente --project-ref txzjjmufcevisnsvtjwt
```

### 4. Usar
**Exercícios → Nova lista →** painel **Assistente UP**. O idioma e o nível vêm do topo da lista.

## Groq (opcional)
1. Crie uma chave em console.groq.com e cadastre o segredo `GROQ_API_KEY`.
2. Em **Usuários → Assistente de IA**, troque o provedor para Groq. Modelo sugerido: `openai/gpt-oss-120b`.

O adaptador do Groq usa a API compatível com OpenAI e ainda não foi testado com uma chave real.

## Limites e cuidados
- O plano grátis do Gemini tem limites por minuto e por dia, que aparecem no AI Studio. Quando estoura, a função tenta de novo duas vezes e depois avisa o professor.
- No plano grátis, o Google pode usar o conteúdo para melhorar os modelos. Por isso só mandamos o pedido do professor e exemplos de exercícios, **nunca** respostas ou dados de alunos.
- Para trocar por um modelo pago depois (Claude, por exemplo), basta um adaptador novo na função e uma linha em `config_ia`.
