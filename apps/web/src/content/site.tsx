// All text of the product site, approved by Luciano on 12/11/2026. Layout lives in
// components/sections. Every person and number in the examples is fictitious.

export const banner = {
  title: "Produto em validação.",
  text: "O Recuidado participa de um programa de validação de produto e ainda não está à venda. Para proteger as famílias, os exemplos desta página usam pessoas e dados fictícios.",
};

export const nav = [
  { href: "#como", label: "Como funciona" },
  { href: "#preco", label: "Preço" },
  { href: "#perguntas", label: "Perguntas" },
];

export const signUpLabel = "Começar o cadastro";

export const hero = {
  title: "Chegou a sua vez de cuidar de quem sempre cuidou de você.",
  text: "O Recuidado acompanha os remédios da sua mãe, do seu pai ou dos seus avós. Na hora certa, o celular avisa. Se não houver confirmação, a gente liga, pergunta como a pessoa está e se já tomou. Se algo não vai bem, você e seus irmãos ficam sabendo na hora.",
  secondary: "Ver como funciona",
  fine: "Quem toma o remédio não precisa saber mexer em aplicativo. A ligação chega em qualquer telefone.",
  confirmed: { label: "Agora · Recuidado", text: <><b>Dona Maria tomou a Losartana</b> das 8h.</> },
  call: { label: "Ligação das 8:15", text: "“Bom dia! Já tomei, minha filha.”" },
};

export const timeline = {
  title: "O que acontece quando a pessoa não confirma que tomou o remédio",
  text: "Na maioria das vezes, a história termina no “Tomei”. A ligação existe para os dias de esquecimento, e o aviso para os dias em que nem a ligação resolve. Veja como foi uma manhã da Dona Maria.",
  // The assistant's own words go in `says`, shown apart in a smaller balloon.
  steps: [
    { time: "8h00", text: "O celular mostra qual remédio tomar naquele horário, com letra grande e um botão só: “Tomei”." },
    {
      time: "8h15",
      text: "Passaram 15 minutos sem confirmação. O Recuidado liga para o celular ou o fixo, sem precisar de internet. Depois de ouvir como ela está, pergunta se já tomou a Losartana das oito.",
      says: "Oi, Dona Maria, bom dia! Aqui é a assistente virtual da Recuidado. Como a senhora está?",
    },
    { time: "8h16", text: "Ela ainda não tomou. A assistente pede que tome agora e liga de novo em 15 minutos." },
    {
      time: "8h31",
      text: "Se ela não tomou ou não atendeu, a assistente liga para um dos filhos. Se ele não atende, liga para o próximo. Todos recebem o aviso no celular e no e-mail.",
      says: "Olá, Carlos, tudo bem? Aqui é da Recuidado. Tentei falar com Dona Maria e não consegui contato. Por favor, tente entrar em contato com ela. Obrigado.",
    },
  ] as { time: string; text: string; says?: string }[],

};

export const howSheIs = {
  title: "Toda ligação começa perguntando como a pessoa está",
  quote: "“Oi, Dona Maria, bom dia! Aqui é a assistente virtual da Recuidado. Como a senhora está?”",
  paragraphs: [
    "Antes de falar do remédio, a assistente pergunta como ela está. Se ela disser que está cansada, com tontura ou com qualquer outra queixa, a família recebe um aviso com as palavras dela, do jeito que ela falou.",
    "Se ela disser que caiu, que está com dor no peito ou com falta de ar, a assistente não fala mais de remédio. Ela avisa que vai chamar a família, desliga para deixar a linha livre e liga para o filho escolhido como primeiro contato, contando o que ela disse. Se ele não atender, liga para o próximo da família, um de cada vez, até alguém ouvir o recado. Todos recebem o aviso no celular desde o começo. Dez minutos depois, liga de volta para ela para saber se alguém já chegou.",
  ],
  fine: "Não somos médicos e não damos nenhum conselho de saúde. Não mudamos dose nem tratamento. A gente só faz a ligação, escuta como ela está e avisa a família. Em emergência, pedimos para ligar para o SAMU, 192.",
};

export const sundayCall = {
  title: "A ligação do Recuidado não substitui a sua",
  text: "A assistente liga para falar do remédio daquele horário e saber se ela está bem. A conversa sobre o neto, a novela e o almoço de domingo continua sendo sua. No app dela há um botão grande para ela ligar para você quando quiser.",
  fine: "A assistente sempre se apresenta como assistente virtual na primeira frase. Quem atende sabe com quem está falando.",
};

export const familyView = {
  title: "Você acompanha o dia de quem você cuida sem precisar perguntar",
  paragraphs: [
    "Na tela Hoje, cada remédio aparece com o horário e o que aconteceu: se foi confirmado no horário, se precisou da ligação ou se ficou sem confirmar. Todo aviso fica guardado, então o irmão que entrou depois também vê o que aconteceu.",
    "No fim do mês, um calendário mostra os dias em que ela tomou tudo, os dias em que precisou da ligação e os que ficaram sem confirmar. Dá para levar esse resumo em PDF para a consulta. Quando a caixa está acabando, a família recebe o aviso antes de faltar.",
  ],
  screen: {
    greeting: "Olá, Ana",
    day: "Hoje, quarta",
    doses: [
      { name: "Losartana 50 mg", status: "Tomou às 8:02", taken: true },
      { name: "Metformina 850 mg", status: "Tomou às 8:17", taken: true },
      { name: "Losartana 50 mg", status: "Às 20:00", taken: false },
      { name: "Rosuvastatina 10 mg", status: "Às 20:00", taken: false },
    ],
    call: { label: "Ligação das 8:15", text: "“Estou bem, só um pouco cansada hoje.”" },
    stock: "A caixa de Rosuvastatina acaba em 4 dias.",
  },
};

export const prescription = {
  title: "Uma foto da receita médica e o plano está pronto",
  text: "Você fotografa a receita do médico, mesmo escrita à mão, e a IA lê cada remédio, a dose e os horários. Você confere antes de salvar. A partir daí, os lembretes e as ligações seguem a receita.",
  card: {
    label: "Lido da receita · confira",
    items: [
      { name: "Losartana 50 mg", times: "8h e 20h" },
      { name: "Metformina 850 mg", times: "8h e 20h" },
      { name: "Rosuvastatina 10 mg", times: "20h" },
    ],
  },
};

export const free = {
  title: "Antes de comprar, a gente mostra o que dá para pegar de graça",
  paragraphs: [
    "Cada remédio da receita é comparado com a lista do Farmácia Popular, com os remédios entregues nos postos de saúde e com o programa de Alto Custo do estado. O mapa mostra as farmácias credenciadas e os postos mais perto da casa dela.",
    "Quando o remédio é de Alto Custo, o app mostra o passo a passo: quais papéis levar, quando o laudo vence e quando renovar.",
  ],
  fine: "Hoje, farmácias e postos de saúde são da cidade de São Paulo.",
  chips: [
    { name: "Losartana", program: "grátis no Farmácia Popular" },
    { name: "Metformina", program: "grátis" },
    { name: "Sacubitril valsartana", program: "Alto Custo" },
  ],
};

export const fairPrice = {
  title: "O que não é de graça, a gente ajuda a pagar o preço justo",
  paragraphs: [
    "Para cada remédio que a família compra, o app mostra o preço máximo que a farmácia pode cobrar, pela tabela oficial do governo (CMED).",
    "E a assistente liga para as farmácias mais perto da casa da pessoa. Ela passa pelo menu de teclas, pergunta se tem o genérico e quanto custa a caixa do genérico e a do remédio de referência. A resposta aparece no app, com o mais barato comparado ao preço máximo.",
  ],
  fine: "Durante a validação, as ligações vão para farmácias fictícias, para não incomodar farmácias de verdade.",
  card: {
    label: "Ligação para a farmácia",
    medicine: "Rosuvastatina 10 mg",
    rows: [
      { label: "Tem na loja", value: "Sim" },
      { label: "Genérico", value: "R$ 21,90" },
      { label: "Referência", value: "R$ 48,50" },
    ],
    note: "O genérico está abaixo do preço máximo.",
  },
};

export const siblings = {
  title: "Os irmãos combinam quem paga o remédio",
  paragraphs: [
    "Cada família escolhe o seu jeito. No rodízio, cada mês um filho compra, na ordem que vocês definirem, e o app avisa de quem é a vez. Na divisão, um filho compra e o app mostra quanto cada irmão deve e a chave Pix de quem comprou.",
    "Cada irmão faz o Pix pelo próprio banco, direto para quem comprou, e avisa no app tocando em “Já paguei”. O Recuidado não recebe nem confere pagamento. Se algum irmão não entra no rodízio, é só marcar no cadastro.",
  ],
  card: {
    label: "Remédios de novembro",
    title: "Ana comprou. Dividido por 2.",
    buyer: { initial: "A", name: "Ana", action: "comprou", note: "recebe a parte do irmão" },
    payer: { initial: "C", name: "Carlos", copyPix: "Copiar Pix", paid: "Já paguei" },
    rotation: { label: "Rodízio", text: <>Dezembro é a vez do <b>Carlos</b></> },
  },
};

export const patientApp = {
  title: "Do outro lado, um botão só",
  paragraphs: [
    "O app de quem toma o remédio mostra qual remédio tomar naquele horário, a dose e o botão “Tomei”. Letra grande, uma coisa por tela, nada para configurar. Quem cadastra tudo é a família.",
    "No cadastro, a família confirma que ela aceita receber as ligações, e no primeiro acesso ao app ela mesma pode dar o aceite. Sem aceite, o Recuidado não liga.",
    "Se ela não usa celular com aplicativo, tudo bem: o lembrete chega por ligação.",
  ],
  screen: {
    greeting: "Bom dia, Maria",
    title: "Hora do remédio",
    time: "8:00",
    medicine: "Losartana",
    dose: "1 comprimido, com água",
    taken: "Tomei",
    callFamily: "Ligar para a família",
  },
};

export const numbers = {
  title: "Muita gente envelhece sem ninguém por perto na hora do remédio",
  items: [
    { value: "40%", text: "de quem mora sozinho no Brasil tem 60 anos ou mais.", source: "PNAD Contínua, IBGE, 2025" },
    { value: "34,4%", text: "dos idosos brasileiros estão com a pressão alta quando ela é medida em casa.", source: "ELSI-Brasil, Fiocruz, 2023-24" },
    { value: "37,9%", text: "dos idosos com dificuldade nas tarefas do dia a dia recebem ajuda. Os outros se viram sozinhos.", source: "ELSI-Brasil, Fiocruz, 2023-24" },
  ],
};

export const pricing = {
  title: "Quase tudo é de graça. As ligações são o plano pago.",
  free: {
    name: "Grátis",
    text: "Ler a receita, ver o que sai de graça, consultar o preço máximo, dividir a conta entre os irmãos e receber o lembrete no celular não custam nada.",
    action: "Começar o cadastro",
  },
  paid: {
    name: "Recuidado Família",
    badge: "7 dias grátis",
    price: "R$ 19,90",
    period: " por mês",
    text: "As ligações custam a cada minuto, então ficam neste plano: a ligação quando ela não confirma, a ligação para a família em emergência e de volta para ela, e a ligação para a farmácia. Cancelou, as ligações param e o resto continua.",
    action: "Começar os 7 dias",
  },
};

export const faq = {
  title: "Perguntas",
  items: [
    {
      question: "Precisa ter smartphone?",
      answer: "Quem toma o remédio, não. Com smartphone, o lembrete aparece no celular e basta tocar em “Tomei”. Sem smartphone, o lembrete chega por ligação no telefone que a pessoa já usa, celular ou fixo. As ligações fazem parte do plano Recuidado Família. Já quem cuida precisa de um smartphone: é pelo app que a família cadastra a receita, acompanha o dia e recebe os avisos.",
    },
    {
      question: "Quem fala na ligação?",
      answer: "Uma assistente virtual com voz. Ela se apresenta assim logo na primeira frase, fala “a senhora” ou “o senhor”, diz o horário por extenso e não tem pressa.",
    },
    {
      question: "E se a pessoa disser que não está bem?",
      answer: "A família recebe o aviso com as palavras de quem atendeu. Se for queda, dor no peito ou falta de ar, o primeiro contato da família recebe uma ligação na hora. Se ele não atender, a assistente liga para o próximo da família, um de cada vez, até alguém ouvir o recado. Todos recebem o aviso no celular desde o começo. Depois, ela liga de volta para quem pediu ajuda.",
    },
    {
      question: "O Recuidado muda o remédio ou a dose?",
      answer: "Nunca. Ele segue a receita que a família conferiu. Mudança de remédio é com o médico.",
    },
    {
      question: "Serve para pai, avó, avô ou tia?",
      answer: "Sim. Serve para qualquer pessoa da família que toma remédio todo dia. No cadastro você escolhe se a assistente fala “a senhora” ou “o senhor”.",
    },
    {
      question: "O que vocês guardam?",
      answer: "O mínimo: sem CPF, sem endereço completo e sem diagnóstico. A gravação e o texto das ligações são apagados em 90 dias. Quem fez o cadastro baixa ou apaga tudo quando quiser.",
    },
  ],
};

export const closing = {
  title: "Comece pelos remédios de quem você cuida",
  text: "Tire uma foto da receita médica ou digite os remédios um por um. Depois, coloque o telefone de quem toma e chame os irmãos que vão acompanhar.",
};

export const inside = {
  title: "Por dentro do Recuidado",
  subtitle: "A tecnologia que faz cada passo funcionar.",
  items: [
    { title: "Voz em tempo real", text: "A ligação funciona em qualquer celular ou telefone fixo. A assistente conversa ao vivo, em português, como em uma ligação comum." },
    { title: "Receita lida por IA", text: "A foto da receita é lida pelo Claude, da Anthropic. A família confere cada remédio antes de salvar." },
    { title: "Dados oficiais", text: "Preço máximo da tabela CMED, da Anvisa. Farmácias credenciadas e remédios grátis do Farmácia Popular, do Ministério da Saúde." },
    { title: "Tudo registrado", text: "Cada ligação fica gravada e transcrita, com o que a assistente fez, para a família conferir depois." },
    { title: "Sem instalar nada", text: "Por enquanto, o app abre no navegador do celular e avisa por notificação e por e-mail. Os apps para Android e iPhone vêm depois." },
    { title: "Conector para assistentes de IA", text: "Quem usa o Claude ou o ChatGPT pode perguntar por lá: “meu pai tomou o remédio da pressão hoje?”." },
    { title: "Privacidade (LGPD)", text: "Ninguém recebe ligação sem aceite. A família exporta ou apaga os dados quando quiser. Gravações e transcrições são apagadas em 90 dias." },
  ],
};

export const footer = {
  text: "Recuidado, produto em validação e ainda não comercializado. Os exemplos usam dados fictícios.",
  character: "A Dona Maria é uma personagem.",
  privacy: "Privacidade",
  email: "privacidade@recuidado.com.br",
};
