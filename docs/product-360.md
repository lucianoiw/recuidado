# Recuidado: visão 360

Levantamento de 11/11/2026 (19 dias para a entrega de 30/11). Compara o que foi planejado em [context.md](context.md) com o que está na `main` e em produção, e reúne o que pensamos sobre evolução, segurança, LGPD, custos e riscos. Cada tema diz o que já está feito, o que foi pensado e ainda não está, e como falar disso no README e no pitch.

Legenda de esforço: P (até meio dia), M (1 a 2 dias), G (3 dias ou mais). Critérios do Hack (todos com o mesmo peso, regra 9.1): Execução técnica (ET), Implementação técnica (IT), Impacto (IM), Comunicação (CO).

## 1. O plano contra o que existe

| Pilar planejado | Estado em 11/11 | O que falta |
| --- | --- | --- |
| 1. Foto da receita vira plano do mês | Feito. Claude lê, família revisa, doses agendadas | Nada essencial |
| 2. O que é grátis e onde | Feito. Farmácia Popular, REMUME das UBS e Alto Custo, farmácias credenciadas perto | Nada essencial |
| 3. Cotar o que não é grátis, com teto CMED | **Não feito.** `monthlyCostCents` nunca é preenchido. Em produção todo remédio aparece "Sem preço". A base CMED já está em `packages/data/seed/cmed-pmc.csv.gz`, só não está ligada | Ligar CMED ao remédio (P). Preço de referência de farmácia online com Firecrawl (M) |
| 4. Dividir o custo e Pix | Parcial. Tela divide em partes iguais, mas sem preço o total é zero. Sem Pix, sem "quem pagou" | Pix copia e cola estático e "marcar como pago" (P a M) |
| 5. Dose em dia, voz, aviso à família | Feito. Push, ligação real, aviso, "não estou bem", remédio acabando, modo demo de 2 min | Religar depois de 30 a 60 min se ninguém agir (P, backlog) |
| Painel com números do mês (reais economizados, doses confirmadas) | **Não feito.** Não há "economia em reais" em nenhuma tela | Depende do pilar 3 (P depois dele) |
| Agente que conversa por mensagem | **Não feito.** Só voz | WhatsApp, ver seção 3 |
| API e MCP próprios | API feita. **MCP não existe** | Servidor MCP com 4 ou 5 ferramentas sobre a API (M) |
| Família demo pronta para o jurado | **Fraca em produção.** Hoje o `GET /family` da demo mostra só Losartana, sem horário e sem dose do dia | Seed fixo da Dona Maria: 3 remédios, horários, preços, 30 dias de histórico (P) |

Conclusão: dois dos cinco pilares da história do vídeo (o custo e a conta da família) ainda não aparecem funcionando, e o número mais forte de impacto ("quanto a família economizou") não existe na tela. Isso pesa em Execução técnica e Impacto antes de qualquer recurso novo.

## 2. Ligação para a farmácia (agente que pergunta estoque e preço)

**Ideia.** Na tela "Onde comprar", a família toca em "Perguntar às farmácias". O agente liga para 1 a 3 farmácias perto da Dona Maria e pergunta: "Vocês têm Losartana 50 mg? Quanto custa a caixa com 30? Atendem pelo Farmácia Popular?". A resposta vira dado (tem ou não, preço, aceita ou não) e aparece na tela comparada ao teto da CMED.

**O que reaproveita.** Todo o caminho de voz já funciona: `apps/voice` (GPT-Live), Asterisk, Nvoip, ferramenta de registro de resposta (`record_dose_answer`), whitelist `CALL_ALLOWED_NUMBERS`, gravação em `voice_calls`. O novo é um segundo roteiro, uma segunda ferramenta (`record_pharmacy_answer`), um endpoint na API e um card na tela.

**Esforço:** M (1,5 a 2 dias). **Peso:** IT alto (agente que executa no mundo real, não só lembra), CO alto (é a cena mais forte do vídeo depois da ligação da Dona Maria), IM médio.

**Riscos e limites.**
- Na demo, a "farmácia" deve ser um número controlado (segundo celular do Luciano ou ator). Ligar para farmácia real sem aviso é ligar para terceiro com IA, gasta saldo e pode irritar o atendente. Fica na whitelist como hoje.
- Farmácias de rede costumam ter URA ("tecle 1"). Não sei se o GPT-Live envia DTMF pelo SIP. Precisa testar. Sem isso, só farmácia com atendimento humano direto.
- Preço dito por telefone é referência, não oferta. A tela deve dizer isso.
- Boa prática: a IA dizer no início que é um assistente automático. Hoje a ligação da Dona Maria só diz "É a Recuidado" quando perguntam.
- Suposição: não é telemarketing (não oferta produto), então a regra do prefixo 0303 da Anatel não se aplicaria. Não confirmei com a Anatel.

**Como falar no pitch.** "O agente não só lembra. Ele liga para a farmácia, pergunta se tem e quanto custa, e traz a resposta para a família."

## 3. WhatsApp

**Por que ficou fora em 10/11.** Risco de bloqueio da Meta, conta oficial verificada exigida para grupo, e prazo de time solo. A Dona Maria é atendida por push e voz, que não dependem da Meta.

**O que mudou na análise (pesquisado em 11/11/2026).**
- Preço: a Meta cobra por mensagem de modelo (template) entregue. Brasil: utilidade cerca de US$ 0,007 a 0,008, marketing cerca de US$ 0,0625. Resposta dentro da janela de 24 h após a pessoa escrever é de graça; segundo provedores, desde 1/10/2026 só as primeiras 1.000 por número por mês ([tabela da Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing), [resumo de provedor](https://reflektlab.ai/blog/whatsapp-business-api-pricing/)). Para a demo o custo é desprezível.
- Prazo: o app de desenvolvedor da Meta dá um número de teste na hora, que manda mensagem só para poucos números cadastrados (pelo que conheço, até 5; não reconfirmei hoje). Não exige verificação de empresa. Número próprio e verificação da empresa levam de dias a semanas e não dá para contar com isso até 30/11. Modelos de mensagem costumam ser aprovados em minutos ou horas.
- Política: desde 15/01/2026 a Meta proíbe assistentes de IA de uso geral na API. Agente de tarefa específica (lembrete de remédio, aviso à família) continua permitido ([TechCrunch](https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform/)).
- Número: o número da API não pode estar no WhatsApp comum. Usar o DID da Nvoip exigiria receber o código de verificação por ligação nele. Não sei se a entrada de ligação está configurada no Asterisk.

**Riscos.** Jurado não consegue testar (só números cadastrados no teste), então o WhatsApp vale só para o vídeo. Dependência de terceiro que pode suspender o número. Mais um canal para manter em 19 dias.

**Recomendação.** Fazer, mas limitado e depois dos itens de execução: WhatsApp só para a família, com o número de teste. Duas coisas: (1) a filha manda a foto da receita no WhatsApp e recebe de volta o que é grátis (é exatamente a cena 1 do vídeo planejado); (2) os avisos (dose perdida, "não está bem", remédio acabando) chegam no WhatsApp além do push. Dona Maria continua em push e voz. **Esforço:** M (2 dias). **Peso:** IM e CO altos (é onde a família brasileira já está), IT médio. Timebox: se não estiver funcionando até 24/11, sai e fica como roadmap.

**Como falar no pitch.** "A Dona Maria não precisa de nada além do telefone. A família recebe no WhatsApp, onde já está."

## 4. Segurança

**Feito.**
- Segredos só em variáveis de ambiente, documentados em `.env.example`.
- HTTPS em todos os serviços. CORS restrito às origens do site.
- API e voz conversam com token (`VoiceTokenGuard`).
- Ligação só para números da whitelist, limite de 3 por família e 20 por dia no total.
- Família demo protegida contra edição.
- Replay de tela no PostHog mascara campos digitados.

**Pensado e não feito (por gravidade).**
1. **Telefone exposto.** `GET /family` sem parâmetro devolve a família demo com o telefone completo da "Dona Maria", sem login. Mascarar na resposta (P). Fazer já.
2. **Sem login.** Quem tem o link com `familyId` vê e altera a família. O id é UUID (difícil de adivinhar), mas o link circula no convite. Para o hack, aceitável e declarado. Depois: login por link mágico ou código por SMS (M).
3. **Sem limite de requisições.** `POST /prescriptions/parse` custa cerca de US$ 0,06 por chamada no Claude e está aberto. `POST /doses/:id/confirm` também aberto. Colocar `@nestjs/throttler` (P).
4. `POST /demo/run` dispara ligação real para o telefone da demo, no máximo uma a cada 4 min. Já limitado; manter.
5. Sem cabeçalhos de segurança (helmet) na API (P).

## 5. LGPD e dados de saúde

Dado de saúde é dado sensível (LGPD, art. 5º II e art. 11). Exige consentimento específico e destacado do titular, que é a Dona Maria, não o filho que cadastra.

**Feito.**
- Toda a demo é sintética (regra do Hack e nossa).
- Minimização: guardamos nome, apelido, telefone, remédios e horários. Sem CPF, endereço ou diagnóstico.
- A ligação guarda a transcrição em `voice_calls`, não há coluna de áudio.
- O agente não decide nada clínico. O roteiro proíbe conselho médico e manda ligar para o SAMU 192 em caso de emergência.
- A família revisa a leitura da receita antes de salvar.

**Pensado e não feito.**
1. **Consentimento da Dona Maria.** O primeiro acesso dela deveria ter "Aceito receber lembrete e ligação, e que minha família veja se tomei" (P). É também a resposta à pergunta "e se ela não quiser ser vigiada?".
2. **Aviso de privacidade** em página própria: quais dados, para quê, quem processa, por quanto tempo, contato (P).
3. **Direitos do titular:** apagar a família inteira e exportar os dados (P a M).
4. **Retenção:** transcrições de saúde ficam para sempre. Definir prazo (ex.: 90 dias) e um job que apaga (P).
5. **Transferência internacional (art. 33):** a foto da receita vai para a Anthropic, o áudio para a OpenAI, os eventos e traces de IA para o PostHog nos EUA (`us.posthog.com`). Os traces de IA contêm o texto da conversa. Declarar no aviso, tirar transcrição dos traces ou mascarar, e avaliar retenção zero nos provedores (P a M).
6. **IA se identificar** no início da ligação (P).

**Regulatório.** Suposição: como não diagnostica nem muda tratamento, o Recuidado não seria software como dispositivo médico (RDC 657/2022 da Anvisa). Não confirmei. Compra de remédio continua simulada (Lei 15.357/2026).

**Como falar no README e no pitch.** Uma seção "Privacidade e limites" com quatro frases: dado de saúde é sensível, por isso a Dona Maria consente; guardamos o mínimo e apagamos em X dias; o agente nunca decide nada clínico; e a lista do que ainda faríamos antes de ter usuário real.

## 6. Custos

- Leitura de receita: cerca de US$ 0,06 por receita, 12 a 16 s (medido em 11/11).
- Ligação: custo por minuto de Nvoip e GPT-Live **ainda não medido**. Medir em 10 ligações e colocar no README (P). Sem isso não dá para responder "quanto custa por idoso por mês", pergunta provável de jurado.
- WhatsApp: centavos de dólar por aviso, ver seção 3.
- Infra: VPS própria com Coolify.

## 7. Para onde o produto pode evoluir (roadmap, para o pitch)

- **Curto prazo:** login, consentimento, WhatsApp oficial verificado, preço de farmácia online, religar se ninguém agir.
- **Integração pública:** receita digital e histórico de retirada do Meu SUS Digital quando houver API; Farmácia Popular avisando o fim do estoque em casa.
- **Quem paga:** família (assinatura baixa), planos de saúde (adesão reduz internação: mediana de 4,29% das internações ligadas a não adesão, ver [impact.md](impact.md)), prefeituras e UBS (agente comunitário acompanha vários idosos), cuidadores e casas de repouso.
- **Mais cuidado, mesmo canal:** consulta e exame já existem no Meu SUS, então ficam fora; foco continua no remédio.

## 8. Entregas do Hack

| Item | Estado |
| --- | --- |
| Repo público, licença MIT, criado depois de 04/11 | Feito |
| Demo HTTPS no ar | Feito; precisa do seed fixo da demo e de um monitor de disponibilidade até 15/12 |
| Vídeo de até 3 min, sem login | Não feito. Roteiro depende de preço, Pix e (se entrar) farmácia e WhatsApp. Reservar 28 e 29/11 |
| Formulário (nome, frase, descrição, trilha, links) | Não feito. Textos podem sair do README |
| Congelar código em 30/11 23h59 | Planejado |

## 9. Ordem recomendada

| # | Item | Esforço | Critérios | Até |
| --- | --- | --- | --- | --- |
| 1 | Mascarar telefone, throttler, helmet | P | ET | 12/11 |
| 2 | Seed fixo da Dona Maria em produção | P | ET, CO | 12/11 |
| 3 | Preço CMED em cada remédio e "economia do mês" | P a M | ET, IM | 14/11 |
| 4 | Ligação para a farmácia | M | IT, CO | 18/11 |
| 5 | Consentimento, aviso de privacidade, apagar dados, retenção | P a M | IM, IT | 19/11 |
| 6 | Pix copia e cola e "quem pagou" | P a M | ET | 20/11 |
| 7 | WhatsApp para a família (número de teste) | M | IM, CO | 24/11 (timebox) |
| 8 | Servidor MCP | M | IT | 25/11, se der |
| 9 | Medir custo por ligação, README 360, vídeo | M | CO | 26 a 29/11 |

Fora por falta de tempo, mas declarado: religar depois de 30 a 60 min, login, preço de farmácia online com Firecrawl.
