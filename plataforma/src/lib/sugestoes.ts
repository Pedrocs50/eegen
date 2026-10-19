import type { Idioma } from "./idiomas";

/**
 * Ideias de pedido para o Assistente UP. A cada vez o painel sorteia algumas, para o professor
 * descobrir usos diferentes em vez de ver sempre os mesmos três exemplos.
 * Separadas por idioma e por faixa de nível (1-2 básico, 3-4 intermediário, 5-6 avançado).
 */
const SUGESTOES: Record<Idioma, Record<"basico" | "intermediario" | "avancado", string[]>> = {
  ingles: {
    basico: [
      "10 questões de simple present sobre rotina de trabalho",
      "Números e preços em situações de compras, com respostas por extenso",
      "Verb to be e apresentações pessoais, com um diálogo curto para ler",
      "Prepositions of place (in, on, at) com lacunas e banco de palavras",
      "Vocabulário de comida e restaurante: pedir, perguntar o preço, pagar a conta",
      "There is / there are descrevendo um escritório ou um quarto de hotel",
      "Horas e rotina diária: what time do you…?",
      "Can / can't para habilidades, com verdadeiro ou falso",
      "Simple past de verbos regulares contando o fim de semana",
      "Lista de revisão de vocabulário de viagem: aeroporto, hotel e transporte",
    ],
    intermediario: [
      "12 questões de present perfect com contexto de viagem",
      "Simple past x past continuous numa história de viagem que deu errado",
      "Comparativos e superlativos escolhendo um hotel ou um voo",
      "First conditional em negociações e prazos de trabalho",
      "Phrasal verbs comuns no escritório (set up, follow up, put off)",
      "Modal verbs de obrigação (must, have to, should) com regras da empresa",
      "Reading curto sobre uma entrevista de emprego com 6 questões",
      "Going to x will: planos e previsões numa reunião",
      "Countable e uncountable com much, many, a lot of",
      "Lista de revisão de vocabulário de trabalho, com um texto curto para ler",
    ],
    avancado: [
      "Second e third conditionals sobre decisões de carreira",
      "Voz passiva em relatórios e comunicados da empresa",
      "Reported speech resumindo uma reunião",
      "Linking words formais (however, whereas, therefore) em e-mails",
      "Collocations de negócios (make a decision, reach an agreement)",
      "Reading sobre trabalho remoto com perguntas de inferência",
      "Phrasal verbs avançados em negociações",
      "Expressões idiomáticas de trabalho, com explicação de cada uma",
    ],
  },
  espanhol: {
    basico: [
      "Exercícios de demonstrativos (este, ese, aquel) com dicas entre parênteses",
      "Ser x estar em apresentações pessoais e no trabalho",
      "Artigos e gênero dos substantivos (el, la, los, las)",
      "Verbos regulares no presente (-ar, -er, -ir) com rotina diária",
      "Números e preços em compras, com respostas por extenso",
      "Vocabulário de roupas e acessórios, com múltipla escolha e lacunas",
      "Hay x está/están descrevendo a cidade",
      "Y ou E, O ou U: escolha a conjunção certa",
      "Completar letras com M ou N (antes de P e B)",
      "Gustar e encantar falando de comidas e hobbies",
    ],
    intermediario: [
      "Pretérito indefinido x imperfecto numa história de viagem",
      "Pronombres de objeto directo e indirecto em pedidos no restaurante",
      "Por x para em situações de viagem e trabalho",
      "Imperativo afirmativo dando instruções no escritório",
      "Advérbios de lugar (aquí, ahí, allí, acá, allá) com um texto curto",
      "Futuro simples fazendo planos para as férias",
      "Reading curto sobre mudar de cidade, com verdadeiro ou falso",
      "Verbos reflexivos na rotina da manhã",
    ],
    avancado: [
      "Subjuntivo para expressar desejos e recomendações no trabalho",
      "Condicional em situações hipotéticas de negócios",
      "Conectores formais (sin embargo, por lo tanto) em e-mails",
      "Expressões idiomáticas do espanhol, com explicação",
      "Reading de opinião sobre trabalho remoto, com perguntas de inferência",
      "Estilo indireto contando o que disseram numa reunião",
    ],
  },
  frances: {
    basico: [
      "Se présenter: verbos être e avoir em apresentações pessoais",
      "Artigos definidos e indefinidos (le, la, les, un, une) com vocabulário da casa",
      "Números e preços no mercado, com respostas por extenso",
      "Verbos do primeiro grupo (-er) no presente com a rotina diária",
      "Dias da semana, horas e compromissos: à quelle heure…?",
      "Vocabulário de comida e restaurante: pedir, perguntar o preço, pagar",
      "Listening de um diálogo curto numa padaria (boulangerie)",
      "Il y a e preposições de lugar descrevendo a cidade",
    ],
    intermediario: [
      "Passé composé com avoir e être contando uma viagem",
      "Passé composé x imparfait numa história do fim de semana",
      "Futur proche x futur simple fazendo planos de trabalho",
      "Pronomes complemento (le, la, lui, leur) em situações de escritório",
      "Comparativos e superlativos escolhendo um hotel",
      "Reading curto sobre morar em Montreal, com verdadeiro ou falso",
      "Listening de uma conversa de check-in no hotel",
    ],
    avancado: [
      "Subjonctif para recomendações e desejos no trabalho",
      "Conditionnel em situações hipotéticas de negócios",
      "Conectores formais (cependant, par conséquent) em e-mails",
      "Expressões idiomáticas francesas, com explicação",
      "Reading de opinião sobre trabalho remoto, com perguntas de inferência",
      "Discours indirect resumindo uma reunião",
    ],
  },
};

function faixa(nivel: number) {
  return nivel <= 2 ? "basico" : nivel <= 4 ? "intermediario" : "avancado";
}

/** Sorteia `quantidade` ideias diferentes para o idioma e o nível da lista. */
export function sortearSugestoes(idioma: Idioma, nivel: number, quantidade = 3): string[] {
  const opcoes = [...SUGESTOES[idioma][faixa(nivel)]];
  for (let i = opcoes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [opcoes[i], opcoes[j]] = [opcoes[j], opcoes[i]];
  }
  return opcoes.slice(0, quantidade);
}
