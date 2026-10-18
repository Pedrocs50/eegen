import { IDIOMAS, nomeNivel, type Idioma } from "./idiomas";
import { FORMATOS, type Formato } from "./exercicios";
import { EXEMPLO_IMPORTACAO } from "./importar";

export type OpcoesPedido = {
  idioma: Idioma;
  nivel: number;
  tema: string;
  foco: string;
  quantidades: Record<Formato, number>;
  leitura: boolean;
  dica: boolean;
  temMaterial: boolean;
};

export const QUANTIDADES_PADRAO: Record<Formato, number> = {
  multipla_escolha: 4,
  verdadeiro_falso: 3,
  lacuna: 4,
  lacuna_opcoes: 0,
  resposta_curta: 2,
  completar_letras: 0,
};

/** O que cada nível significa, para o Claude calibrar vocabulário e gramática (referência CEFR). */
const DESCRICAO_NIVEIS = [
  "nível 1 (≈ A1): frases curtas, presente, vocabulário básico do dia a dia",
  "nível 2 (≈ A2): situações de rotina, passado e futuro simples, perguntas e respostas curtas",
  "nível 3 (≈ B1): textos curtos com opinião e relato, tempos compostos mais comuns, condicionais simples",
  "nível 4 (≈ B1+/B2): situações de trabalho e viagem, voz passiva, discurso indireto",
  "nível 5 (≈ B2): argumentação, expressões e verbos com preposição, conectivos formais",
  "nível 6 (≈ C1): textos longos e nuances, registro formal e informal, expressões idiomáticas",
];

/** Monta o texto que o professor cola no Claude (claude.ai) para gerar uma lista no formato de importação. */
export function montarPedido(o: OpcoesPedido): string {
  const idioma = IDIOMAS[o.idioma];
  const nivel = nomeNivel(o.idioma, o.nivel);
  const pedidos = (Object.keys(o.quantidades) as Formato[])
    .filter((f) => o.quantidades[f] > 0)
    .map((f) => `- ${o.quantidades[f]} × ${f} (${FORMATOS[f].nome})`)
    .join("\n");

  return `Você é o assistente pedagógico da UP English, a escola de idiomas da Teacher Monique Barros.
Crie uma lista de exercícios de ${idioma} para importar na nossa plataforma.

## A lista
- Idioma: ${idioma} ("${o.idioma}")
- Nível: ${nivel} = ${DESCRICAO_NIVEIS[o.nivel - 1]}
- Tema: ${o.tema || "(escolha um tema útil para este nível)"}
${o.foco ? `- Foco e observações do professor: ${o.foco}\n` : ""}- Questões:
${pedidos || "- (escolha uma mistura equilibrada de formatos, cerca de 12 questões)"}
${o.leitura ? "- Inclua 1 seção de leitura (tipo \"texto\") com um texto original de 120 a 200 palavras e questões de reading sobre ele (conte essas questões dentro do total acima).\n" : ""}${o.dica ? "- Comece com 1 seção do tipo \"dica\" explicando em português, em 2 a 4 frases, o ponto principal do tema.\n" : ""}${o.temMaterial ? "- Anexei o material da aula: use SÓ o vocabulário, as estruturas e os exemplos do material, sem copiar frases inteiras dele.\n" : ""}
## Como a escola ensina
- Público: adolescentes mais velhos e adultos, muitos profissionais. Nada infantil.
- Contextos práticos e reais: trabalho, viagem, entrevistas, rotina, cultura. Varie nomes e situações.
- Enunciados e frases no idioma estudado; títulos de seção, instruções e explicações em português, curtas e simpáticas, como a "Dica" dos nossos slides.
- Toda questão tem "explicacao": 1 frase em português dizendo por que a resposta está certa (pode citar a regra).
- Alternativas erradas plausíveis (erros que alunos desse nível realmente cometem); exatamente 1 correta.
- Varie a posição da alternativa correta.
- Conteúdo 100% original: não copie trechos de livros, séries, músicas ou sites.

## Regras de cada formato
- multipla_escolha: "opcoes" (2 a 5 textos) e "correta" (índice começando em 0).
- verdadeiro_falso: "enunciado" é uma afirmação; "resposta" é true ou false.
- lacuna: marque cada lacuna com ___ no "enunciado"; "respostas" é uma lista por lacuna, com TODAS as formas aceitas (ex.: [["didn't go", "did not go"]]); "banco" (opcional) são palavras para o aluno escolher.
- lacuna_opcoes: ___ no "enunciado"; "opcoes" é uma lista de opções por lacuna; "corretas" é o índice certo de cada lacuna.
- resposta_curta: "aceitas" lista todas as respostas aceitáveis (com e sem hífen, contrações etc.).
- completar_letras: a palavra com _ no lugar de cada grupo de letras que falta (ex.: "Co_bustible"); "respostas" por lacuna.
- Acentos contam (Éste x Este). NÃO coloque versões sem acento em "respostas"/"aceitas"; se o acento não for o ponto do exercício, use "ignorar_acentos": true.
- "habilidade": listening, reading, grammar, vocabulary ou writing.
- Tipos de seção: "questoes" (só questões), "texto" (campo "texto" para ler + questões) ou "dica" (campo "texto", sem questões).

## Formato da resposta
Responda APENAS com um bloco \`\`\`json contendo um objeto neste formato (o exemplo mostra todos os formatos; siga as quantidades pedidas acima, não as do exemplo):

\`\`\`json
${JSON.stringify({ ...EXEMPLO_IMPORTACAO, idioma: o.idioma, nivel: o.nivel }, null, 2)}
\`\`\`
`;
}
