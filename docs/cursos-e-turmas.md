# Cursos, aulas e turmas — em espera

**Status:** pausado em 18/10/2026, para focar nos exercícios. O código continua no projeto e funcionando; só não vamos evoluir esta parte por enquanto.

## O que já existe

### Banco (Supabase)
Migração [`0002_cursos_aulas_turmas.sql`](../supabase/migrations/0002_cursos_aulas_turmas.sql), já rodada no projeto.

| Tabela | Para que serve |
|---|---|
| `cursos` | Idioma (`ingles`/`espanhol`), nível (1 a 6), título e descrição |
| `aulas` | Aulas de um curso: número, tema, frase de abertura, link do material (PDF) |
| `turmas` | Turma de um professor, ligada a um curso, com código de 6 letras e opção de encerrar entradas |
| `matriculas` | Alunos de cada turma |
| `aulas_liberadas` | Quais aulas cada turma pode ver |

Regras de acesso (RLS):
- Admin e professor criam e editam cursos e aulas.
- Cada professor só vê e gerencia as **próprias** turmas; o admin vê todas.
- O aluno entra numa turma só com o código, pela função `entrar_na_turma(codigo)`. Ele não consegue listar turmas.
- O aluno só vê os cursos em que está matriculado e só as aulas **liberadas** para a turma dele.
- O professor vê nome e e-mail dos alunos das suas turmas, e o aluno vê o nome dos seus professores.

### Telas
| Rota | Quem | O que faz |
|---|---|---|
| `/professor` | professor, admin | Início com totais e atalhos |
| `/cursos` | professor, admin | Lista com filtro por idioma; criar curso |
| `/cursos/:id` | professor, admin | Editar ou apagar o curso; criar, editar e apagar aulas |
| `/turmas` | professor, admin | Lista de turmas com código e nº de alunos; criar turma |
| `/turmas/:id` | professor, admin | Código e "Copiar convite", liberar ou bloquear aulas, remover alunos, encerrar entradas |
| `/aluno` | aluno, admin | Entrar em turma pelo código; ver os cursos e as aulas liberadas |
| `/aulas/:id` | aluno, professor, admin | Capa da aula no padrão dos materiais e link do PDF; espaço reservado para as listas de exercícios |

Arquivos: `plataforma/src/paginas/{Cursos,Curso,Turmas,Turma,AreaAluno,Inicios}.tsx` e `plataforma/src/lib/dados.ts`.

### Níveis
A escala é a mesma nos dois idiomas, só os nomes mudam. Os nomes estão em `NIVEIS`, em `plataforma/src/lib/dados.ts`. São uma **suposição**: ainda falta confirmar com a escola.

| Nº | Inglês | Espanhol |
|---|---|---|
| 1 | Beginner | Principiante |
| 2 | Elementary | Básico |
| 3 | Pre-Intermediate | Pre-intermedio |
| 4 | Intermediate | Intermedio |
| 5 | Upper-Intermediate | Intermedio alto |
| 6 | Advanced | Avanzado |

## O que ficou pendente
- Revisar o fluxo completo com o Pedro: ele rodou a migração e testou, mas ainda não deu retorno detalhado.
- Confirmar os nomes dos níveis.
- Ligar as **listas de exercícios** às aulas (`/aulas/:id` já tem o espaço "Hora de praticar!").
- E-mail próprio para os convites e as confirmações. O SMTP grátis do Supabase manda poucos e-mails por hora.
- Link de convite que já entra na turma, sem precisar digitar o código.
- Reordenar aulas arrastando, em vez de editar o número.
- Datas de liberação: abrir a aula automaticamente num dia marcado.

## Como retomar
1. Ler este arquivo e a migração `0002`.
2. Testar o fluxo com duas contas: professor (cria curso, aula e turma, copia o convite, libera a aula) e aluno (entra com o código, abre a aula).
3. Ligar os exercícios às aulas: a tabela de listas de exercícios ganha um `aula_id` opcional.
