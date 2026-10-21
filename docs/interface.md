# Interface: convenções de acessibilidade e usabilidade

Regras que as telas seguem, vindas da revisão de 21/10/2026 (skills `web-design-guidelines` e `bencium-controlled-ux-designer`). Valem para telas novas.

## Idioma do conteúdo
A página é `pt-BR`, mas os exercícios estão em inglês, espanhol ou francês. Todo texto na língua estudada (enunciados, alternativas, lacunas, texto de leitura, transcrição do listening, resposta esperada) usa **`lang` + `translate="no"`**:
- `NoIdioma` (em `componentes/QuestaoAluno.tsx`) marca um trecho; `LANG_HTML` (em `lib/idiomas.ts`) converte o idioma da lista em `en`/`es`/`fr`.
- Motivos: o leitor de tela pronuncia no idioma certo, e o tradutor do navegador não traduz o exercício (o que entregaria a resposta).
- Dicas, instruções e explicações ficam em português, sem `lang`.
- Campos de resposta usam `spellCheck={false}`, para o corretor não sublinhar os erros do aluno.
- As alternativas e o verdadeiro/falso não têm `aria-label`, porque o `aria-label` não carrega o idioma: o nome do campo vem do texto visível do rótulo.

## Cores e contraste
- Texto normal precisa de **4,5:1** e texto grande ou ícone, de 3:1. Os tokens do tema claro e do escuro (`--c-*` em `index.css`) passam em todos os pares usados; ao mudar um token, confira os pares texto/fundo (ex.: `coral` sobre `coral-suave`).
- Nada de texto menor que 11 px.

## Foco do teclado
Um anel único para tudo que é interativo, definido em `index.css` na camada `base` (3 px, cor `--c-destaque`, 2 px de folga). Campos que já têm o próprio realce (`focus:ring-*`) continuam mandando, porque os utilitários ficam acima da camada `base`. Nunca use `outline-none` sem um substituto de foco.

## Movimento
`prefers-reduced-motion` desliga `animate-pulse` e `animate-bounce` e deixa as transições quase instantâneas. O `animate-spin` (carregando) continua, por ser o único sinal de atividade. Não use `transition-all`: liste as propriedades (`transition-[width]`). Rolagem suave por JS verifica `matchMedia("(prefers-reduced-motion: reduce)")`.

## Toque
Botões de ícone ficam compactos com mouse e passam a **44 px** em telas de toque, com `pointer-coarse:size-11`. `touch-action: manipulation` vale para links, botões e campos.

## Campos
Todo campo tem nome acessível: `<label>` associado ou `aria-label`. Placeholders mostram um exemplo, não repetem o rótulo.

## Pendente da revisão
- Menu do celular: fechar com Esc, travar a rolagem do fundo e levar o foco para dentro.
- Diálogo de confirmação próprio no lugar do `confirm()` do navegador (15 usos).
- Filtros de Resultados, Biblioteca e Cursos na URL.
- Link "Pular para o conteúdo", `tabular-nums` nas notas, `text-wrap: balance` nos títulos.
