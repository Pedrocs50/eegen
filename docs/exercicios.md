# Exercícios — desenho da solução

**Status (18/10/2026):** a **fase 1 está implementada** (migração `0003`, editor do professor em `/exercicios`, aluno em `/praticar`). As demais fases continuam como proposta.

### O que a fase 1 entregou
- **Banco:** `listas → secoes → questoes`, com o gabarito numa tabela separada que o aluno não consegue ler.
- **Correção no servidor:** pela função `enviar_tentativa`, que ignora maiúsculas, espaços, hífens e pontuação nas pontas. Acentos contam, a menos que a questão permita ignorar. Lacunas dão nota parcial.
- **Salvamento:** pela função `salvar_lista`, de uma vez. Ela atualiza, cria e remove seções e questões sem apagar as respostas das questões que continuam.
- **Editor:** seis formatos (múltipla escolha, V/F, lacuna, lacuna com opções, resposta curta, completar letras); seções com texto ou "Dica"; reordenar, duplicar e apagar; pendências antes de publicar; "Testar como aluno".
- **Aluno:** lista de exercícios com barra de progresso e melhor nota; tela de responder com a correção no estilo dos slides de "Respostas" (✓/✗, resposta esperada e dica); refazer.
- **Visibilidade:** por enquanto, toda lista **publicada** aparece para todo aluno logado. Quando cursos e turmas voltarem, a lista passa a ser liberada por turma.
- **Testes:** as migrações e a correção foram testadas num Postgres local (PGlite), com usuários simulados de admin e de aluno.

Objetivo: o professor cria muitas listas de exercícios rápido, com ajuda de um assistente de IA, no padrão de ensino da UP English. O aluno responde com correção na hora e acompanha o próprio progresso.

---

## 1. Tipos de exercício

Cada questão é descrita por quatro características independentes. Isso deixa o sistema crescer sem virar uma lista solta de tipos.

| Característica | Valores |
|---|---|
| **Habilidade** | listening, reading, grammar, vocabulary, writing (speaking fica para depois) |
| **Estímulo** (o que o aluno recebe) | nenhum · texto · áudio · imagem |
| **Formato de resposta** (como o aluno responde) | ver tabela abaixo |
| **Correção** | automática exata · automática tolerante · IA · professor |

### Formatos de resposta

| Formato | Exemplo (dos materiais da escola) | Correção | Fase |
|---|---|---|---|
| Múltipla escolha | "Why do they choose Oxford?" (A/B/C) | automática | 1 |
| Verdadeiro ou falso | "Sam does not want milk." | automática | 1 |
| Lacuna (digitar) | "____ coche es del profesor (Éste/Este)" | tolerante: lista de respostas aceitas, ignora maiúsculas e pontuação, avisa sobre acento | 1 |
| Lacuna (escolher) | "¿Y o E? Ana ___ Isabel van a venir" | automática | 1 |
| Resposta curta / por extenso | "851 → eight hundred and fifty-one" | tolerante (variações aceitas, "and" opcional) | 1 |
| Completar letras | "Co\_bustible", "Ca\_pa\_illa" | automática | 1 |
| Associação (ligar colunas) | palavra ↔ tradução, pergunta ↔ resposta | automática | 2 |
| Classificação (agrupar) | countable / uncountable; este / ese / aquel | automática | 2 |
| Ordenar | palavras para formar a frase; falas do diálogo | automática | 2 |
| Ditado | ouvir e escrever a frase | tolerante (nota por semelhança) | 2 |
| Tradução | PT → EN | IA, com respostas de referência | 3 |
| Escrita livre | "Write 5 sentences about your routine" | IA com critérios, revisão do professor | 3 |
| Fala | gravar a resposta | IA (transcrição + critérios) | futuro |

### Estrutura de uma lista
É a mesma lógica das aulas da Monique: uma lista tem **seções**, e cada seção tem um estímulo opcional e várias questões.

```
Lista "Hora de praticar | Prepositions of movement"   (capa no padrão, idioma, nível)
 ├─ Seção 1: "Listening: Weekend trip"   estímulo = áudio (roteiro com falas) → 3 múltipla escolha + 3 V/F
 ├─ Seção 2: "Complete com a preposição"   sem estímulo → 6 lacunas com banco de palavras
 └─ Seção 3: "Dica"   (cartão coral, só leitura, sem questões)
```

Toda questão pode ter uma **explicação**, que aparece na correção, como os slides de "Respostas".

---

## 2. Áudio dentro da plataforma

Hoje o áudio sai do `gerador.py` (edge-tts + FFmpeg) no computador ou no GitHub Actions. Na plataforma:

- O roteiro da seção usa o mesmo formato que já usamos (`FALANTE: fala`). Cada falante ganha uma voz (britânica, americana ou australiana), escolhida automaticamente ou pelo professor.
- Uma **função no servidor** (Supabase Edge Function) gera o áudio:
  1. sintetiza cada fala;
  2. junta tudo num MP3 com pausas;
  3. guarda no Storage.

  Não precisa de FFmpeg: trechos de MP3 com o mesmo formato podem ser emendados direto, com um trecho de silêncio pronto entre eles.
- **Cache:** um áudio é identificado pelo conteúdo (roteiro + vozes). Mexer só nas perguntas não gera o áudio de novo.
- **Velocidade:** o player do aluno já oferece 0.75× e 1×. Não precisamos gerar uma versão lenta.
- **Transcrição:** o professor escolhe se o aluno vê o texto antes, depois de responder ou nunca.

**Risco:** o edge-tts é uma API **não oficial** da Microsoft. Ela já parou uma vez nesta conversa (erro 403, resolvido atualizando a biblioteca). Por isso a geração de áudio fica atrás de uma interface única. Se o edge-tts quebrar de vez, trocamos pelo **Azure Speech oficial**: mesmas vozes, cerca de 500 mil caracteres grátis por mês, e ele aceita várias vozes e pausas num único pedido. O resto da plataforma não muda.

---

## 3. Assistente de IA para o professor

### O que ele faz
- **Gerar uma lista a partir de um pedido.** Exemplo: "B1, present perfect, 1 listening de diálogo no aeroporto com 4 perguntas, 6 lacunas e 3 V/F."
- **Gerar a partir do material da aula:** o professor anexa o PDF da aula e a IA cria exercícios só com o vocabulário e os pontos daquela aula.
- **Ajustar uma questão:** "mais difícil", "troque o contexto", "outra alternativa errada mais convincente", "traduza a dica".
- **Corrigir escrita livre e tradução** (fase 3), com critérios do professor, nota sugerida e comentário. O professor pode alterar.

### Como funciona (decisão técnica)
- **Não é um agente autônomo.** É uma sequência controlada: o pedido do professor gera um **rascunho estruturado** (JSON validado contra o formato de lista, seção e questão acima). O rascunho abre no editor e **nada vai para o aluno sem o professor revisar e publicar**. É mais barato, mais previsível e mais fácil de corrigir que um agente solto.
- **Modelo:** Claude Opus 5.5 (`claude-opus-5-5`) pela API da Anthropic. A chamada roda numa Edge Function, e a chave fica no servidor, nunca no site.
- **Saída estruturada:** usamos o recurso de structured outputs da API, para a resposta vir sempre no formato certo, e validamos de novo antes de salvar.
- **PDF:** a API lê PDF direto (até 600 páginas por pedido). Os materiais de 19 a 33 slides cabem com folga.
- **Estilo da escola:** um texto fixo de orientação vai em todo pedido: tom da Monique, exemplos bilíngues, "Dica", explicação em toda questão, nada infantil, descrição de cada nível. Ele é guardado em cache pela API, o que barateia os pedidos seguintes.
- **Checagens automáticas antes de mostrar o rascunho:**
  - toda múltipla escolha tem exatamente uma correta;
  - toda lacuna tem resposta aceita;
  - as perguntas de listening só falam do que está no roteiro.

### Custo aproximado (preços de outubro/2026)
O Opus 5.5 custa US$ 4 por milhão de tokens de entrada e US$ 20 por milhão de saída.

| Ação | Estimativa por vez |
|---|---|
| Gerar uma lista de ~15 questões com 1 listening | ~US$ 0,20 a 0,30 |
| Mesma coisa, a partir de um PDF de ~30 slides | ~US$ 0,35 a 0,50 |
| Ajustar uma questão | ~US$ 0,02 |
| Corrigir uma resposta de escrita livre | ~US$ 0,02 a 0,04 |

São estimativas: o custo real vai aparecer nos primeiros usos. Dá para pôr um limite mensal de gasto na conta da Anthropic. Também dá para usar um modelo mais barato (Sonnet 5.5, cerca de metade do preço), se você preferir. Isso fica para medirmos.

### Como usar o "Criar com o Claude" (já disponível)
1. Em **Exercícios → Nova lista**, escolha o idioma e o nível no topo. O painel "Criar com o Claude" já vem aberto.
2. Preencha o tema, o foco (opcional) e quantas questões quer de cada tipo. Marque "Dica", "texto de leitura" ou "vou anexar o PDF da aula", se for o caso.
3. Clique em **Copiar pedido** e depois em **Abrir o Claude**. Se marcou o PDF, anexe o arquivo no Claude. Cole o pedido e envie.
4. Copie a resposta inteira do Claude (pode vir com texto em volta) e cole no **Passo 2**. Clique em **Importar para a lista**.
5. Revise as questões (pendências aparecem com ⚠), clique em **Testar como aluno** e, por fim, em **Publicar**.

Detalhes:
- O formato de importação está em `plataforma/src/lib/importar.ts` (`EXEMPLO_IMPORTACAO`); o texto do pedido está em `plataforma/src/lib/pedidoClaude.ts`.
- O conversor tolera bloco ```json, texto antes e depois, vírgula sobrando e aspas curvas.
- Questões de formato desconhecido são puladas com aviso.
- Numa lista vazia, a importação preenche título, tema, frase, idioma e nível. Numa lista com questões, as seções entram no final.

### Opções sem custo (por enquanto)

> **Atualização:** a opção 2 virou o **Assistente UP** (Gemini grátis, com Groq como alternativa), dentro do editor. Detalhes e publicação em [assistente-ia.md](assistente-ia.md).
A API do Claude não tem plano grátis. Para começar sem gastar, em ordem de recomendação:

1. **"Importar do Claude" (custo zero, melhor qualidade). ✅ Implementado: painel "Criar com o Claude" no editor.**
   - Deixamos pronto um texto de pedido (com o estilo da escola e o formato JSON da lista).
   - O professor cola esse texto no Claude que já usa (claude.ai), com o tema, o nível e, se quiser, o PDF da aula.
   - Depois cola o resultado no botão **Importar** do editor, e a lista abre como rascunho para revisar.
   - Funciona porque a função `salvar_lista` já recebe a lista inteira em JSON.
   - Também posso gerar lotes de listas daqui do Claude Code, direto no banco.
2. **Botão "Gerar com IA" usando um plano grátis de outro provedor:**
   - **Groq:** modelos abertos, como o gpt-oss-120b. Há relatos de algo como 1.000 pedidos e 200 mil tokens por dia no plano grátis.
   - **Google Gemini:** o plano grátis tem limites que o Google mostra no AI Studio.
   - **Cloudflare Workers AI:** 10 mil "neurons" por dia, compartilhados entre os modelos.

   Cuidados:
   - os limites mudam com frequência e variam conforme a fonte;
   - a qualidade em espanhol e no estilo da escola tende a ser menor;
   - em planos grátis, o provedor pode usar o conteúdo para melhorar os modelos (confirmar nos termos). Por isso **não** mandamos respostas de alunos para esses serviços: usamos só para gerar exercícios.
3. **Claude API (pago),** quando o volume justificar. A geração fica atrás de uma interface única na Edge Function: trocar de provedor é mudar uma configuração, não reescrever a plataforma.

### Técnicas aproveitadas do Emma's Librarian
O repositório [mastrien/emmas_librarian](https://github.com/mastrien/emmas_librarian) (app de artigos científicos com IA) já resolve problemas que vamos ter. O que levamos para cá:

| Técnica de lá | Como fica aqui |
|---|---|
| **Um adaptador por provedor** com a mesma interface (`complete(prompt, modelo)`) para OpenAI, Gemini, Anthropic e Ollama | Na Edge Function: um adaptador "compatível com OpenAI" cobre de uma vez Groq, Gemini, Ollama e OpenRouter, e outro cobre o Claude. Trocar de provedor é configuração. |
| **Modelo por habilidade** (tabela `ai_model_config`: resumo, extração e metadados podem usar modelos diferentes) | Tabela `config_ia`: `gerar_lista`, `ajustar_questao` e `corrigir_escrita`, cada uma com o seu provedor e modelo, editável pelo admin. Ex.: gerar com Groq grátis hoje e passar para o Claude depois, sem mexer no código. |
| **Conserto de JSON** (`jsonRepair`): tira o bloco ```json, vírgula sobrando, quebra de linha dentro de texto, JSON dentro de string | Essencial com modelos grátis, que não garantem o formato. Depois do conserto, validamos com o esquema da lista. Se falhar, pedimos de novo uma vez, mandando os erros encontrados. |
| **Repetir com espera crescente no erro 429** (cota estourada) | Os planos grátis estouram cota fácil. Repetimos 2 ou 3 vezes com espera crescente e, se ainda falhar, mostramos "limite do plano grátis atingido, tente em alguns minutos". |
| **Erros com código e detalhe** (`ERR_INVALID_AI_RESPONSE`, o valor que veio errado e o formato esperado) | O professor vê uma mensagem clara; o detalhe técnico vai para o histórico de gerações. |
| **Resposta com evidência** (trecho + página que justificam cada resposta) | Ao gerar a partir do PDF da aula, cada questão traz "baseado no slide N", para o professor conferir rápido. |
| **Conjuntos de perguntas reutilizáveis** (globais ou por projeto) | **Modelos de pedido** salvos: "Listening B1 padrão", "Revisão de vocabulário"… o professor reaproveita com um clique. |
| **Resultado da IA guardado no banco** (não gera de novo o que já existe) | Tabela `geracoes_ia` com o pedido, o resultado e o custo; o rascunho pode ser reaberto. |
| **Embeddings locais grátis** (MiniLM via transformers.js) | Agora não precisamos: os PDFs das aulas cabem inteiros no pedido. Fica para depois, para achar questões **parecidas ou repetidas** no banco de questões. |
| **Testes de banco contra um banco real** (não simulado) | Já fizemos isso com PGlite para a migração `0003`. Próximo passo: guardar esse teste no repositório e rodar no GitHub Actions. |

O que **não** copiamos:
- **Chaves de API:** lá elas ficam salvas no próprio app, o que serve para programa de computador. Aqui ficam só no servidor, nunca no navegador.
- **Montagem dos pedidos:** lá os pedidos são montados colando texto direto dentro do JSON de exemplo, e isso quebra com aspas.
- **Texto do PDF:** lá ele é cortado em 80 mil caracteres sem aviso.
- **Tempo de espera:** lá é de 30 s, curto para gerar uma lista inteira.

### Livros, séries e músicas (para depois)
- **Ideia:** listas temáticas, como "situações de Friends" ou "vocabulário de Harry Potter".
- **Cuidado com direitos autorais:** não podemos copiar trechos de roteiros, livros ou letras de música. O caminho seguro é a IA criar **diálogos originais inspirados no tema**, ou o professor usar trechos curtos com a fonte citada.

---

## 4. Como o professor cria e edita

1. **Nova lista** e escolha entre **"Criar do zero"** e **"Criar com IA"**.
2. **Criar com IA:**
   - Um formulário curto: idioma, nível, tema, quantas questões de cada tipo (botões), se terá listening e o foco.
   - Opcionalmente, anexar o PDF da aula.
   - Um campo livre: "Algo mais?"
3. **Rascunho no editor:**
   - Seções em cartões; cada questão com Editar, Pedir à IA ("mais difícil"…), Duplicar, Apagar e arrastar para reordenar.
   - Seção de listening: o roteiro editável, as vozes por falante, o botão **Gerar áudio** e o player.
   - **Prévia do aluno** ao lado.
4. **Capa** gerada no padrão "HORA DE PRATICAR!" com o tema da lista. Depende do arquivo da fonte Neo Sans Pro.
5. **Publicar.** Quando cursos e turmas voltarem, a lista também poderá ser ligada a uma aula e liberada para uma turma.

---

## 5. Progresso do aluno

Para cada lista e cada aluno, há duas medidas, e sempre mostramos as duas:
- **Conclusão:** a lista foi enviada? (0 ou 100%)
- **Desempenho:** percentual de acertos.

Regras propostas:
- **Tentativas:** o aluno pode refazer a lista. Vale a **melhor** nota, e o professor vê todas as tentativas.
- **Aula:** progresso = listas concluídas ÷ listas liberadas da aula; desempenho = média das melhores notas.
- **Curso:** progresso = listas concluídas ÷ listas liberadas no curso. Isso depende de cursos e turmas, hoje em espera.
- **Por habilidade:** desempenho em listening, grammar, vocabulary… Mostra onde o aluno precisa praticar.

Para o aluno:
- barra de progresso no curso e em cada aula;
- selo "concluída" com a nota nas listas;
- um cartão "sua habilidade mais forte / para praticar".

Sem pontuação de jogo nem mascotes: o público é adulto.

Para o professor:
- uma tabela da turma (aluno × lista), com cor pela nota;
- as questões que mais erraram;
- quem ainda não fez.

---

## 6. Rascunho do banco (a confirmar)

```
listas         id, titulo, idioma, nivel, tema, capa_url, status (rascunho|publicada),
               origem (manual|ia), aula_id (opcional, para quando cursos voltar), criado_por
secoes         id, lista_id, ordem, titulo, instrucao, tipo_estimulo (nenhum|texto|audio|imagem|dica),
               estimulo (jsonb: texto | roteiro + vozes + audio_url + quando_mostrar_transcricao | imagem_url)
questoes       id, secao_id, ordem, formato, habilidade, enunciado, conteudo (jsonb, específico do formato),
               gabarito (jsonb), explicacao, pontos
tentativas     id, lista_id, aluno_id, iniciada_em, enviada_em, nota
respostas      tentativa_id, questao_id, resposta (jsonb), correta, pontos, comentario_ia, revisado_por
geracoes_ia    id, professor_id, pedido, resultado, custo_estimado, criado_em   (histórico e controle de gasto)
```

**Gabarito protegido:** o gabarito fica numa coluna que o aluno **não pode ler**. A correção roda no servidor, ao enviar. Assim, ninguém vê as respostas certas olhando o navegador.

---

## 7. Ordem de construção sugerida

| Fase | Entrega | Por quê nesta ordem |
|---|---|---|
| 1 | Banco de listas, seções e questões; editor manual com os formatos da fase 1; aluno respondendo com correção na hora | É a base que a IA vai preencher; sem ela não há onde salvar o que a IA gera |
| 2 | Geração de áudio na plataforma e seção de listening | Reaproveita o que já funciona no `gerador.py` |
| 3 | Assistente de IA: gerar lista, ajustar questão, a partir do PDF | Já tem editor e formato para validar a saída |
| 4 | Progresso e resultados | Precisa de respostas reais para mostrar |
| 5 | Formatos da fase 2 (associação, classificação, ordenar, ditado) | Ampliam a variedade |
| 6 | Escrita com correção por IA; listas temáticas (livros e séries) | Mais complexas e com custo por uso |

Os 16 roteiros atuais em `roteiros/` viram as primeiras listas de teste, importadas automaticamente.

---

## 8. Decisões em aberto
1. **IA:** começar pelo "Importar do Claude" (sem custo) e decidir depois entre um plano grátis (Groq ou Gemini) ou a API do Claude.
2. **Refazer lista:** o aluno pode refazer à vontade, ou com limite?
3. **Escrita livre:** a nota da IA vale direto, ou só depois que o professor confirmar?
4. **Transcrição do listening:** o padrão é mostrar só depois de responder?
5. **Fonte Neo Sans Pro** para gerar as capas: falta o arquivo e confirmar a licença de uso na web.
