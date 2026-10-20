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
4. Aprovado, o aluno passa a ver a turma em **Minha turma** e em **Exercícios**.

Quem já tem conta abre o mesmo link (ou digita o código em Minha turma) e o pedido é criado do mesmo jeito. "Encerrar entradas" faz o código parar de aceitar pedidos.

## Telas
| Rota | Quem | O que faz |
|---|---|---|
| `/turmas` | professor, admin | Turmas com alunos, aulas liberadas e selo de pedidos |
| `/turmas/:id` | professor, admin | Abas Aulas (liberar), Extras (listas avulsas, salva sozinho) e Alunos (pedidos, alunos e convite). Atalhos para Resultados e "Ver como aluno" |
| `/cursos`, `/cursos/:id` | professor, admin | Biblioteca: cursos e aulas, com PDF ou link e os exercícios de cada aula. Mostra as turmas que seguem o curso |
| `/aluno` | aluno (e a equipe, como visão do aluno) | Minha turma: progresso, próximo exercício, aulas da mais recente para a primeira (selo "Nova" por 7 dias), extras e entrada em outra turma |
| `/praticar` | aluno (e equipe) | Exercícios separados em abas **Das aulas** (agrupados por aula) e **Extras**, com filtro feitos/não feitos e busca |
| `/aulas/:id` | aluno, equipe | Capa, PDF dentro do site e "Hora de praticar!" |
| `/convite/:codigo` | todos | Cadastro com o código (sem login) ou pedido de entrada (logado) |

Se o aluno está em mais de uma turma (por exemplo, inglês e espanhol), escolhe a turma no topo. A última escolhida fica lembrada.

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

## Pendente
- Datas de liberação: abrir a aula sozinha num dia marcado.
- Reordenar aulas arrastando, em vez de editar o número.
- Prazo de entrega nos extras.
- Confirmar os nomes dos níveis com a escola.
