# Recuidado

Contexto do projeto Recuidado no Hack Brasil 2026 (antes o time se chamava "Plano Popular"). A ideia do nome é cuidar de quem cuidou da gente.

Time de 1 integrante, Luciano Souza. Trilha 4, Saúde e bem-estar.

## Em uma frase

O Recuidado é um agente de IA que cuida do remédio do idoso junto com a família. Ele mostra o que é de graça no Farmácia Popular, cota o resto, divide o custo entre os filhos e garante que a dose seja tomada, inclusive ligando para quem não usa app.

## O problema

- O Farmácia Popular oferece 41 itens gratuitos (hipertensão, diabetes, asma, colesterol, Parkinson, glaucoma e outros) em farmácias credenciadas. O Ministério da Saúde estima economia de até R$ 733 por mês por família, mas muita gente ainda paga sem saber.
- O que não é gratuito pesa no orçamento, e ninguém sabe quanto custa nem quem paga.
- O cuidado do idoso crônico fica espalhado entre filhos, receitas em papel, horários de remédio e contas sem dono.
- Muitos idosos não usam app nem gov.br, então ferramentas que dependem disso não chegam até eles.

## A personagem

Dona Maria, 68 anos, hipertensa e diabética, mora sozinha e tem dois filhos que moram longe. Toda a demo e o vídeo contam a história dela. Dados sempre sintéticos.

## O que o agente faz

1. **Foto da receita.** Lê a receita e monta o plano do mês.
2. **O que é grátis.** Cruza cada remédio com a lista do Farmácia Popular e indica a farmácia credenciada mais perto.
3. **O que não é.** Cota o resto, usa o preço máximo da CMED como teto e mostra quanto a família economiza.
4. **A conta da família.** Divide o custo entre os filhos, manda o Pix para cada um e mostra quem já pagou.
5. **A dose em dia.** Lembra a Dona Maria no horário. Para quem não usa app, o lembrete é uma ligação de voz da IA. Se ela não confirmar, avisa os filhos.

## O que o governo já faz (pesquisado em 10/11/2026)

- Meu SUS Digital mostra a lista do Farmácia Popular, as farmácias credenciadas e o histórico de remédios retirados. Exige conta gov.br.
- O Ministério anunciou que o Farmácia Popular vai enviar lembrete de remédio de uso contínuo. Não foi encontrado como funciona.
- Está previsto integrar receita digital, autorização e retirada ao Meu SUS Digital.
- Agendamento, confirmação e lembrete de consulta já existem no Meu SUS Digital e em vários estados. Por isso a parte de consulta saiu do projeto.
- Não foi encontrado em nenhuma fonte: cruzamento da receita da pessoa com o que é grátis, cotação do que não é, divisão de custo entre a família, família acompanhando as doses de um adulto, e lembrete por ligação de voz para quem não usa app.

Posicionamento: complemento ao que existe, não concorrente. O diferencial é a família dividindo o cuidado e o custo, e o agente chegando em quem não usa app.

## Por que não é "mais um app"

- O produto é um agente que executa. A família e a Dona Maria conversam por mensagem ou voz, e o agente age.
- Por baixo existe uma API e um MCP de "cuidado do remédio" que qualquer agente pode usar.
- A interface é mínima e serve para ver o resultado: o que é grátis, o que custa, quem pagou e as doses.

## Dados públicos usados

- Lista de medicamentos gratuitos e de farmácias credenciadas do Farmácia Popular (Ministério da Saúde)
- Preço máximo de medicamentos (CMED, Anvisa)
- Estabelecimentos de saúde (CNES, DataSUS), para localizar farmácias
- Preços de referência de farmácias online, coletados com Firecrawl

## O que a demo mostra (vídeo de até 3 minutos)

1. A filha manda a foto da receita da Dona Maria.
2. O agente responde que dois dos três remédios são de graça no Farmácia Popular e indica a farmácia mais perto. O terceiro custa R$ X, dividido entre os dois filhos.
3. Os filhos recebem a cobrança Pix e o painel mostra quem pagou.
4. Na hora da dose, a IA liga para a Dona Maria e ela confirma por voz.
5. Em outro dia ela não confirma, e o agente avisa os filhos.
6. O painel fecha com os números do mês: reais economizados e doses confirmadas.

## Como atende aos critérios do Hack Brasil

Os quatro critérios têm o mesmo peso (regra 9.1).

| Critério | Como o Recuidado responde |
| --- | --- |
| Execução técnica | Fluxo inteiro funcionando de ponta a ponta com uma personagem só |
| Implementação técnica | Agente que executa, leitura de receita por IA, ligação de voz, API e MCP próprios, dados públicos, mensageria e Pix |
| Impacto | Economia real para a família com base em números oficiais, e cuidado que chega em quem não usa app |
| Comunicação | Uma história só, a da Dona Maria, com a IA ligando para ela ao vivo |

## Fora do escopo do hackathon

- Compra real de medicamento. A compra fica simulada (Lei 15.357/2026 limita plataformas a logística e entrega).
- Consulta e vaga do SUS.
- Grupo de WhatsApp, que exige conta oficial verificada. As mensagens são 1:1.
- Qualquer decisão clínica. O agente não recomenda tratamento nem muda dose.

## Riscos conhecidos

- O lembrete do Farmácia Popular pode cobrir parte do item 5. O diferencial precisa ser a família e a voz.
- A lista de farmácias credenciadas nos dados abertos já foi apontada como desatualizada.
- A coleta de preços pode esbarrar em bloqueio de site. O preço é referência, não oferta.
- Precisa ficar claro que é saúde, não finanças. A divisão de custo é recurso, não tema.
- Ligação de voz depende de serviço de telefonia. Na demo, o número da "Dona Maria" é de um ator, nunca de pessoa real sem consentimento.

## Regras do Hack Brasil que guiam o desenvolvimento

- Repositório novo e público no GitHub, criado depois de 04/11/2026 às 21h, sem código privado anterior. Código aberto público pode entrar como dependência.
- Demo no ar em link HTTPS que abra sem login, durante toda a avaliação.
- Vídeo de até 3 minutos.
- Submissão até 30/11/2026 às 23h59. Depois disso não pode haver commit até a final.
- Nenhum dado real de terceiros na demo. Saúde usa dados sintéticos.
- Final presencial em 12/12/2026 no Google for Startups, em São Paulo.

## Convenções de código

- Pastas, pacotes, tabelas, identificadores, comentários e PRs em inglês. Só o texto que o usuário lê fica em português.
- Usar sempre a versão estável mais nova de cada pacote.
- Stack preferida: TypeScript, NestJS, Next.js, PostgreSQL, Redis e BullMQ, Docker.