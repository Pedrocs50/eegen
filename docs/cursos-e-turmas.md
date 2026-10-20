# Turmas, cursos e aulas

**Status (19/10/2026):** ativo. É a espinha da plataforma: o aluno só vê o que foi liberado para a turma dele.

## A ideia
O conteúdo (**biblioteca**) fica separado de para quem e quando (**turma**):

```
BIBLIOTECA (montada uma vez)
└─ Curso "Inglês · Beginner"
   └─ Aula 1, 2, 3...   → material (PDF ou link) + exercícios da aula
                          (os exercícios vêm do banco de listas, em /exercicios)

TURMAS (o dia a dia da professora)
└─ Turma "Beginner · Terça 19h" → segue um curso
   ├─ Aulas      → a professora libera depois de dar a aula
   ├─ Extras     → listas avulsas só desta turma (revisão, prática, prova)
   ├─ Alunos     → link de convite + aprovação de quem pediu para entrar
   └─ Resultados → /resultados?turma=...
```

Um curso pode servir a várias turmas, e cada turma libera as aulas no próprio ritmo.

## Quem vê o quê
- **Aluno sem turma ou com o pedido pendente:** não vê nenhum exercício, só "Entre na sua turma" ou "Pedido enviado".
- **Aluno aprovado:** vê as aulas liberadas para a turma dele, com o material e os exercícios publicados de cada uma, mais os extras publicados da turma.
- **Lista publicada fora de qualquer aula e de qualquer turma:** ninguém de fora da equipe vê. A página Exercícios mostra "Fora das turmas" nesses casos.
- **Equipe:** vê tudo. Em "Visão do aluno" (`/aluno`), escolhe uma turma e vê exatamente o que os alunos dela veem.

## Entrada do aluno
1. A professora copia a mensagem de convite na aba **Alunos** da turma. Ela traz o link `/convite/CÓDIGO`.
2. O aluno abre o link, e o cadastro já vem com o código preenchido. Sem um código válido, o cadastro não é enviado.
3. O pedido fica **pendente**. A professora vê o aviso no início e na turma, e então aprova ou recusa. "Aprovar todos" também existe.
4. Aprovado, o aluno passa a ver a turma em **Minhas turmas**.

Quem já tem conta abre o mesmo link (ou digita o código em Minha turma) e o pedido é criado do mesmo jeito. "Encerrar entradas" faz o código parar de aceitar pedidos.

## Telas
| Rota | Quem | O que faz |
|---|---|---|
| `/turmas` | professor, admin | Turmas com alunos, aulas liberadas e selo de pedidos |
| `/turmas/:id` | professor, admin | Abas Aulas (liberar), Extras (listas avulsas, salva sozinho) e Alunos (pedidos, alunos e convite). Atalhos para Resultados e "Ver como aluno" |
| `/cursos`, `/cursos/:id` | professor, admin | Biblioteca: cursos e aulas, com PDF ou link e os exercícios de cada aula. Mostra as turmas que seguem o curso |
| `/aluno` | aluno (e a equipe, como visão do aluno) | **Minhas turmas**: um bloco por turma, com curso, progresso, a próxima aula ao vivo e os selos "Aula nova" e "extras novos". Pedidos pendentes aparecem como blocos à parte. Embaixo, entrar em outra turma |
| `/aluno/turmas/:id` | aluno (e equipe) | Página da turma: topo com o progresso e "Entrar na aula", e as abas **Início** (aula ao vivo, próximo exercício, atalhos, aula mais recente), **Aulas**, **Exercícios** ("Das aulas", agrupados por aula, e "Extras", com filtro e busca) e **Ao vivo** |
| `/aulas/:id` | aluno, equipe | Capa, PDF dentro do site e "Hora de praticar!" |
| `/convite/:codigo` | todos | Cadastro com o código (sem login) ou pedido de entrada (logado) |

Cada turma fica separada: o aluno escolhe o bloco e tudo o que vê dentro é daquela turma. Os links de aula e de exercício levam `?turma=`, então o "voltar" leva de volta à turma certa. Os endereços antigos `/praticar` e `/aluno?turma=` redirecionam para a página nova.

## Banco
Migrações `0002` (cursos, aulas, turmas, matrículas, aulas liberadas), `0009` (PDF e exercícios da aula) e `0011` (aprovação, extras e a nova regra de visibilidade).

| Tabela | Para que serve |
|---|---|
| `cursos` | Idioma (`ingles`/`espanhol`/`frances`), nível (1 a 6), título e descrição |
| `aulas` | Aulas de um curso: número, tema, frase de abertura e o material (PDF enviado em `material_arquivo`/`material_nome`, ou link em `material_url`) |
| `aula_listas` | Exercícios de cada aula, na ordem |
| `turmas` | Turma de um professor, ligada a um curso, com código de 6 caracteres e "entradas abertas" (`ativa`) |
| `matriculas` | Aluno na turma, com `situacao` (`pendente`/`aprovada`) e `aprovada_em` |
| `aulas_liberadas` | Aulas que cada turma já vê |
| `turma_listas` | Exercícios extras de cada turma, na ordem |

**Funções:**
- `entrar_na_turma(codigo)` cria o pedido.
- `conferir_codigo_turma(codigo)` pode ser chamada sem login e mostra a turma no cadastro.
- O gatilho de cadastro lê `codigo_turma` dos dados do cadastro e já cria o pedido.
- `lista_visivel` aplica a regra de visibilidade (usada também pelo envio de respostas).

**Regras de acesso:**
- A professora só gerencia as próprias turmas; o admin, todas.
- Só ela aprova ou recusa: o aluno não consegue mudar a própria matrícula.

Os PDFs ficam no bucket **privado** `materiais` (até 50 MB) e abrem por um link assinado que vale 1 hora.

## Exemplos
`supabase/exemplos/cursos_de_exemplo.sql` (gerado pelo `montar.py`) cria um curso de exemplo por idioma:
- uma aula por lista de exemplo;
- uma "Turma de teste";
- as primeiras aulas já liberadas e as listas restantes como extras.

Rode depois de `listas_de_exemplo.sql`.

## Atalhos para a professora
- **Criar exercício dentro da aula:**
  - o botão "+ Exercício" em cada aula do curso (ou no formulário da aula) abre o editor em `/exercicios/nova?aula=ID`;
  - idioma, nível e tema já vêm da aula, e o Assistente UP já traz o pedido com o tema;
  - no primeiro salvamento, a lista entra na aula;
  - no editor, a faixa "Aparece em" mostra em quais aulas e turmas cada lista está.
- **Mensagens prontas para o grupo** (WhatsApp), em `plataforma/src/lib/turmas.ts`:
  - **convite:** link `/convite/CÓDIGO`, passo a passo e o código. Fica na aba Alunos, com prévia, e no ícone de cada card em Turmas;
  - **aviso de aula liberada:** aparece logo depois de liberar e no ícone de cada aula liberada;
  - **aviso dos extras:** um link para cada lista.
- **Reordenar aulas:** arraste pela alça (no computador) ou use as setas. Os números são regravados na ordem nova.

## Aula ao vivo
Migração `0013`. Cada turma pode ter:
- um **link fixo da reunião** (Google Meet; outras plataformas também funcionam, desde que o link comece com `https://`);
- os **horários semanais**, no horário de Brasília;
- um **aviso do dia** opcional, com a data até quando fica visível.

**Professora:** aba **Ao vivo** da turma. Tem o passo a passo para criar um link fixo no Google Agenda, o botão "testar o link" e "Copiar link e horários para o grupo".

**Aluno:** cartão "Aula ao vivo" no Início e na aba Ao vivo da turma, e o botão compacto no topo da turma:
- **verde**, "Acontecendo agora", durante a aula;
- **azul-marinho**, "Começa em X minutos", a partir de 15 minutos antes;
- **discreto**, com "Próxima aula: amanhã às 19:00", no resto do tempo.

O cálculo usa o horário de Brasília (`plataforma/src/lib/aoVivo.ts`), então funciona mesmo com o aluno em outro fuso.

**Segurança:** o link fica numa tabela própria (`turma_encontros`) e só os alunos **aprovados** leem. Quem está com o pedido pendente vê o nome da turma, mas não o link.

**Depois, com e-mail próprio:** lembrete por e-mail antes da aula e, se fizer sentido, gerar o Meet automaticamente pela API do Google Agenda.

## Notificações
Migração `0012`. São criadas por gatilhos no banco, então não dependem de ninguém estar com o site aberto. Ficam no sininho do menu, com o número de não lidas, e na página `/notificacoes`. O menu também mostra quantos pedidos de entrada estão pendentes em **Turmas**.

| Tipo | Para quem | Padrão |
|---|---|---|
| `pedido_entrada`: aluno pediu para entrar | professora da turma | ligada |
| `nota_baixa`: aluno da turma tirou menos de 60% | professoras das turmas do aluno | ligada |
| `exercicio_feito`: aluno enviou um exercício | professoras das turmas do aluno | desligada |
| `entrada_aprovada` | aluno | ligada |
| `aula_liberada` | alunos aprovados da turma | ligada |
| `extra_liberado`: lista publicada nos extras | alunos aprovados da turma | ligada |

**Detalhes:**
- Cada pessoa liga e desliga os tipos na própria página de notificações. As escolhas ficam em `perfis.preferencias_notificacao`, e o que não estiver lá segue o padrão da função `quer_notificacao`.
- Tentativas da equipe não geram aviso.
- Ninguém cria notificação pela API, só os gatilhos.
- Próximos tipos possíveis: aluno parado há X dias, extra com prazo chegando e resumo semanal por e-mail (quando o e-mail próprio estiver configurado).

## Pendente
- Datas de liberação: abrir a aula sozinha num dia marcado.

- Prazo de entrega nos extras.
- Confirmar os nomes dos níveis com a escola.
