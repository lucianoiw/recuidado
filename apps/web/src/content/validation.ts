// Result of the Recuidado at Tribunal de Ideias (13/11/2026), approved by Luciano on the site
// canvas (boards Site-Validacao and Site-Validacao-Dobra). On the site it is a "validação":
// never "julgamento", "inocente", "juiz", "acusação", "jurados" or "testemunhas".
// Quotes are verbatim from the report; buyers, people and evaluators are simulated by AI.

export const tribunalUrl = "https://www.tribunaldeideias.com.br/pt/julgamento/cmwf7dqqk0003jzu6waeplpvh";

export const validationScore = {
  score: "86",
  scoreMax: "/100",
  badge: "Pronta para avançar",
  summary: "Voz para idoso sem app e conta entre irmãos formam um diferencial forte, mas preço e aceitação ainda precisam de prova.",
  facts: [
    { value: "38 de 60", text: "compradores simulados comprariam" },
    { value: "R$ 10 a R$ 30", text: "faixa de preço aceita por eles; o plano custa R$ 19,90" },
    { value: "12 de 12", text: "avaliadores aprovaram, dois deles com ressalvas" },
  ],
  criteriaTitle: "Notas dos avaliadores por critério",
  criteria: [
    { label: "Relevância", value: 4.8 },
    { label: "Solução", value: 4.8 },
    { label: "Timing", value: 4.8 },
    { label: "Diferencial", value: 4.5 },
    { label: "Execução", value: 4.2 },
    { label: "Mercado", value: 4.0 },
    { label: "Gestão de risco", value: 3.9 },
    { label: "Tração projetada", value: 3.6 },
    { label: "Monetização", value: 3.4 },
  ],
};

export const validationFold = {
  eyebrow: "Validação no Tribunal de Ideias",
  title: "Colocamos o Recuidado à prova antes de ele chegar às famílias.",
  text: "No Tribunal de Ideias, plataforma que testa ideias de negócio com IA, vários modelos de empresas diferentes analisaram o Recuidado: uns apontaram problemas, outros responderam, 60 compradores simulados reagiram à oferta e 12 avaliadores deram nota em nove critérios.",
  action: "Ver a validação completa",
  fine: "Validação de 13/11/2026. Compradores e avaliadores são simulados por IA, não clientes.",
};

export const validationPage = {
  metaTitle: "Recuidado: validação no Tribunal de Ideias, 86 de 100",
  metaDescription:
    "Como o Recuidado foi posto à prova no Tribunal de Ideias: notas de 12 avaliadores, críticas e respostas, 60 compradores simulados, a conta do negócio e o que ainda falta provar.",
  eyebrow: "Validação no Tribunal de Ideias",
  title: "Colocamos o Recuidado à prova antes de ele chegar às famílias.",
  text: "No Tribunal de Ideias, vários modelos de IA de empresas diferentes analisam uma ideia de negócio. Uns apontam os problemas, outros respondem, 60 compradores simulados reagem à oferta e 12 avaliadores dão nota de 0 a 5 em nove critérios. No fim, um parecer diz o que está forte e o que ainda falta provar. Este é o resultado do Recuidado.",
  tribunalAction: "Ver o laudo completo no Tribunal de Ideias",

  opinion: {
    eyebrow: "O parecer final",
    paragraphs: [
      "Considero a ideia forte em relevância, solução, diferencial e timing. Entre os concorrentes encontrados, Goldies faz lembrete em app e RenovatioMed exige dispositivo físico. Nenhum reúne ligação de voz para quem não usa app, cruzamento da receita com o Farmácia Popular, ligação à farmácia e divisão da conta entre irmãos. A dificuldade de acompanhar a tomada dos remédios aparece em relatos reais, como o da família que duvidava se a idosa ingeria os medicamentos corretamente. Os R$ 19,90 estão dentro da faixa aceitável de R$ 10 a R$ 30.",
      "As fragilidades estão em monetização e gestão de risco. Os compradores simulados questionaram se o idoso aceita a ligação da IA, o custo com chamadas extras, as receitas manuscritas e a falta de suporte humano. O ponto de equilíbrio é de 51 clientes, bem acima das 10 famílias previstas para o piloto.",
      "A dor de pagar por remédio que é grátis e a de dividir a conta entre irmãos ainda não têm relato real: são hipóteses a validar.",
    ],
    author: "Claude Sonnet 5.5, da Anthropic, depois de ouvir todos os lados",
  },

  debate: {
    title: "Três modelos procuraram os problemas. Três responderam.",
    text: "Cada resposta rebate uma crítica. As frases entre aspas são do laudo.",
    critiques: {
      label: "Críticas",
      items: [
        { who: "GPT-6.1 Sol, OpenAI", quote: "Uma confirmação não equivale a cuidado comprovado.", text: "Atender ao telefone e declarar uma dose não demonstram adesão nem aliviam, por si, a vigilância familiar." },
        { who: "GLM-5.2, Zhipu", quote: "O concorrente já tem os clientes, o app e o preço menor.", text: "A ideia cobra o dobro do concorrente mais próximo, oferece garantia mais fraca e pode ser copiada em semanas." },
        { who: "Mistral Large 4, Mistral", quote: "Ninguém provou que pagam.", text: "Falta prova de que alguém pagará R$ 19,90 por mês: ainda não há entrevistas nem lista de espera." },
      ],
    },
    answers: {
      label: "Respostas",
      items: [
        { who: "GPT-6.1 Terra, OpenAI", quote: "Pagamento real vale mais que intenção simulada.", text: "A disposição a pagar ainda não foi demonstrada: teste a renovação depois dos sete dias e a aceitação das ligações." },
        { who: "DeepSeek V4 Pro, DeepSeek", quote: "O concorrente lembra; o Recuidado executa.", text: "Executa por voz, sem app, cruza o Farmácia Popular, liga para a farmácia e divide a conta entre irmãos, funções que nenhum concorrente encontrado reúne." },
        { who: "Gemini 4 Argon, Google", quote: "Não promete prova clínica, mas elimina a angústia do silêncio à distância.", text: "Substitui o silêncio da distância por checagem ativa, com dupla ligação e áudio gravado." },
      ],
    },
  },

  people: {
    title: "Seis filhos e filhas, simulados, disseram se comprariam.",
    text: "Pessoas criadas pela IA com perfis de quem cuida dos pais: renda, cidade e como cuidam hoje.",
    yes: "Compraria",
    no: "Não compraria",
    items: [
      { name: "Gabriela, 37 anos", buys: true, quote: "Já tentei apps; agora quero uma IA que liga para minha mãe.", text: "Minha mãe não usa celular; uma IA que liga e me avisa é o que preciso. Só temo a audição dela." },
      { name: "Renata, 42 anos", buys: true, quote: "Essa ideia resolveria meu problema real de organizar remédios da minha mãe entre irmãos.", text: "Minha única dúvida é se a leitura de receitas manuscritas funcionaria bem com as receitas difíceis que ela tem." },
      { name: "Fernanda, 57 anos", buys: true, quote: "Recuidado economiza e garante que minha mãe tome os remédios.", text: "Eu pagaria se mostrasse o que é grátis e onde." },
      { name: "Wagner, 38 anos", buys: false, quote: "Prefiro o que conheço ao que pode dar errado.", text: "Preciso ver provas de que idosos aceitam essas ligações na prática." },
      { name: "Flávia, 47 anos", buys: false, quote: "Vinte reais por mês é muito para o que já gasto sem garantia.", text: "Não sei se o idoso vai atender ou entender as ligações." },
      { name: "Patrícia, 37 anos", buys: false, quote: "R$ 19,90 por mês não cabe no meu orçamento.", text: "Com desconto para quem tem plano de saúde, eu pensaria." },
    ],
  },

  buyers: {
    title: "60 compradores simulados viram a oferta.",
    text: "Respostas de IA, não de clientes: servem para achar as objeções antes de falar com famílias de verdade.",
    big: "38 de 60",
    bigText: "comprariam o Recuidado Família por R$ 19,90 por mês.",
    pricesTitle: "Quanto pagariam por mês",
    prices: [
      { group: "Todos os compradores", range: "R$ 10 a R$ 30" },
      { group: "Classe média, com pais morando sozinhos", range: "R$ 10 a R$ 30" },
      { group: "Classe média alta em capitais, com pais em outra casa ou cidade", range: "R$ 10 a R$ 35" },
    ],
    pricesNote: "O plano custa R$ 19,90: dentro da faixa de todos os grupos.",
    objectionsTitle: "Por que os outros não comprariam",
    of: "/60",
    objections: [
      { label: "Se o idoso aceita a ligação da IA", count: 16, quote: "Não diz se a IA já foi testada com idosos reais para garantir que eles aceitam as ligações e não ficam assustados." },
      { label: "Recursos e compatibilidade", count: 14, quote: "Não sei se o Recuidado é compatível com o meu plano de saúde atual." },
      { label: "Preço e custo-benefício", count: 11, quote: "Não diz se o custo total com as ligações pode aumentar se o idoso precisar de muitos lembretes ou chamadas extras." },
      { label: "Receitas manuscritas", count: 9, quote: "Não diz se o sistema funciona bem com receitas manuscritas muito difíceis de ler, que minha mãe tem várias." },
      { label: "Suporte humano", count: 6, quote: "Não diz se há suporte humano para casos em que a IA não consegue resolver." },
      { label: "Ligação para a farmácia", count: 4, quote: "Não explica como a IA sabe qual tecla apertar se a farmácia muda o menu de atendimento." },
    ],
  },

  math: {
    title: "A conta do negócio",
    text: "Calculada pelo Tribunal com os números do plano, que ainda são estimativas.",
    items: [
      { value: "R$ 11,91", text: "sobram por família por mês, depois do custo variável" },
      { value: "51 famílias", text: "pagam o custo fixo" },
      { value: "3,4 meses", text: "para a família devolver o custo de conquista" },
      { value: "5 vezes", text: "o valor da família ao longo do tempo sobre o custo de conquistá-la" },
    ],
  },

  evaluators: {
    title: "O que cada um dos 12 avaliadores escreveu",
    text: "Doze modelos de IA, de onze empresas, deram nota sozinhos e depois revisaram a nota lendo os colegas.",
    items: [
      { model: "Grok 4.20", company: "xAI", score: 92, quote: "Agente de voz resolve silêncio da distância com economia real." },
      { model: "MiniMax M3.1 Flash", company: "MiniMax", score: 91, quote: "A cunha é a voz para quem não usa app." },
      { model: "Nova 2 Lite", company: "Amazon", score: 90, quote: "Resolva dor real com IA para idosos." },
      { model: "Seed 2.0 Mini", company: "ByteDance", score: 89, quote: "Atende dor real de cuidadores à distância, com soluções específicas e diferenciais claros, mas precisa validar aceitação e preço." },
      { model: "Llama 4 Maverick", company: "Meta", score: 88, quote: "Dor específica e mecanismo viável, mas aceitação da IA ainda não provada." },
      { model: "Gemini 2.5 Flash", company: "Google", score: 88, quote: "Recuidado: a IA que traz a família de volta à vida." },
      { model: "Mistral Medium 3.1", company: "Mistral", score: 88, quote: "Dor real, solução inovadora, mas validação é chave." },
      { model: "Hermes 4 405B", company: "Nous", score: 88, quote: "Solução inovadora para dor real, mas monetização ainda precisa de validação." },
      { model: "Kimi K2", company: "Moonshot", score: 87, quote: "Dor real e mecanismo claro, mas aceitação da IA e disposição a pagar ainda não provadas." },
      { model: "GPT-6 Luna Pro", company: "OpenAI", score: 80, quote: "Voz e coordenação familiar enfrentam uma dor concreta, ainda por validar." },
      { model: "Solar Pro 4", company: "Upstage", score: 75, quote: "A dor é nomeada e o mecanismo ataca de frente, mas a conta fecha sem provar que a família paga." },
      { model: "Claude Haiku 5.5", company: "Anthropic", score: 74, quote: "Dor real, mecanismo claro, mas o preço ainda precisa de prova." },
    ],
  },

  steps: {
    title: "O que ainda falta provar, com meta",
    text: "O parecer pede duas provas: que quem toma o remédio aceita a ligação da assistente e que a família continua no plano pago depois dos 7 dias grátis. Estes são os passos, e são eles que guiam a fase de testes.",
    goal: "Meta:",
    items: [
      { title: "Oferecer os 7 dias grátis a 30 filhos e filhas", goal: "19 de 30 aceitam em 3 semanas" },
      { title: "Piloto de ligações com 10 famílias", goal: "8 de 10 idosos atendem e seguem recebendo ligações em 30 dias" },
      { title: "Criar um plano anual com desconto", goal: "3 em 10 assinantes escolhem o anual em 60 dias" },
      { title: "Dizer quantas ligações o plano inclui", goal: "8 de 10 famílias do piloto mantêm o plano depois do limite em 45 dias" },
      { title: "Prometer suporte humano na emergência e mostrar gravação e transcrição", goal: "15 de 30 abordados começam o teste grátis em 21 dias" },
      { title: "Ligar para farmácias reais e comparar com o preço máximo da CMED", goal: "20 farmácias informam estoque e preço em 3 semanas" },
      { title: "Testar receitas manuscritas difíceis", goal: "15 famílias salvam a receita sem corrigir remédio em 30 dias" },
    ],
  },

  about: {
    items: [
      { value: "195", text: "chamadas a modelos de IA" },
      { value: "9 min 38 s", text: "de análise" },
      { value: "13/11/2026", text: "data da validação" },
    ],
    fine: "Documento gerado por inteligência artificial a partir de busca pública e da análise de vários modelos. Pessoas, avaliadores e compradores são simulados, não clientes. As frases entre aspas são do laudo; o resto resume o laudo sem acrescentar nada.",
    link: "Laudo original",
  },
};
