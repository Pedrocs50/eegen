# Cursos, aulas e turmas — em espera

**Status:** pausado em 18/10/2026, para focar nos exercícios. Em 19/10/2026 as aulas ganharam o PDF dentro do site e os exercícios da aula. Para professor e aluno a parte continua escondida (`CURSOS_E_TURMAS_ATIVOS` em `plataforma/src/lib/recursos.ts`); o admin vê tudo, marcado como "Em obra".

## O que já existe

### Banco (Supabase)
Migrações [`0002_cursos_aulas_turmas.sql`](../supabase/migrations/0002_cursos_aulas_turmas.sql) e [`0009_aulas_com_pdf.sql`](../supabase/migrations/0009_aulas_com_pdf.sql).

| Tabela | Para que serve |
|---|---|
| `cursos` | Idioma (`ingles`/`espanhol`/`frances`), nível (1 a 6), título e descrição |
| `aulas` | Aulas de um curso: número, tema, frase de abertura e o material: PDF enviado (`material_arquivo`, `material_nome`) ou link (`material_url`) |
| `aula_listas` | Exercícios de cada aula, na ordem (`ordem`) em que aparecem em "Hora de praticar!" |
| `turmas` | Turma de um professor, ligada a um curso, com código de 6 letras e opção de encerrar entradas |
| `matriculas` | Alunos de cada turma |
| `aulas_liberadas` | Quais aulas cada turma pode ver |

Os PDFs ficam no bucket **privado** `materiais` (até 50 MB, só PDF). O site abre o arquivo por um link assinado que vale 1 hora.

Regras de acesso (RLS):
- Admin e professor criam e editam cursos e aulas.
- Cada professor só vê e gerencia as **próprias** turmas; o admin vê todas.
- O aluno entra numa turma só com o código, pela função `entrar_na_turma(codigo)`. Ele não consegue listar turmas.
- O aluno só vê os cursos em que está matriculado e só as aulas **liberadas** para a turma dele.
- O professor vê nome e e-mail dos alunos das suas turmas, e o aluno vê o nome dos seus professores.
- O PDF e os exercícios de uma aula só abrem para a equipe e para os alunos com a aula liberada. Só a equipe envia ou apaga PDFs.

### Telas
| Rota | Quem | O que faz |
|---|---|---|
| `/professor` | professor, admin | Início com totais e atalhos |
| `/cursos` | professor, admin | Lista com filtro por idioma; criar curso |
| `/cursos/:id` | professor, admin | Editar ou apagar o curso; criar, editar e apagar aulas. Cada aula recebe o material (enviar PDF ou colar link) e os exercícios, em ordem. O ícone de olho abre a aula como o aluno vê |
| `/turmas` | professor, admin | Lista de turmas com código e nº de alunos; criar turma |
| `/turmas/:id` | professor, admin | Código e "Copiar convite", liberar ou bloquear aulas, remover alunos, encerrar entradas |
| `/aluno` | aluno, admin | Entrar em turma pelo código; ver os cursos e as aulas liberadas |
| `/aulas/:id` | aluno, professor, admin | Capa da aula, o PDF dentro do site (Google Drive/Docs em quadro embutido) e "Hora de praticar!" com os exercícios, a nota de cada um e o link para fazer |

Arquivos: `plataforma/src/paginas/{Cursos,Curso,Turmas,Turma,AreaAluno,Inicios}.tsx`, `plataforma/src/componentes/{LeitorPdf,ExerciciosDaAula}.tsx`, `plataforma/src/lib/{dados,materiais}.ts`.

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
- A aba **Aulas** na área de exercícios do aluno (hoje mostra "Em breve").
- E-mail próprio para os convites e as confirmações. O SMTP grátis do Supabase manda poucos e-mails por hora.
- Link de convite que já entra na turma, sem precisar digitar o código.
- Reordenar aulas arrastando, em vez de editar o número.
- Datas de liberação: abrir a aula automaticamente num dia marcado.

## Como retomar
1. Ler este arquivo e a migração `0002`.
2. Testar o fluxo com duas contas: professor (cria curso, aula e turma, copia o convite, libera a aula) e aluno (entra com o código, abre a aula).
3. Testar uma aula com PDF enviado, uma com link do Drive e os exercícios no fim, pelo olho "Ver como aluno".
