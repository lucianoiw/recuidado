# Recuidado

[![CI](https://github.com/lucianoiw/recuidado/actions/workflows/ci.yml/badge.svg)](https://github.com/lucianoiw/recuidado/actions/workflows/ci.yml)
[![Licença MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-0b5d57)](LICENSE)

Agente de IA que cuida do remédio do idoso junto com a família.

O Recuidado lê a receita, mostra o que é de graça no Farmácia Popular, cota o resto com o teto da CMED e garante que a dose seja tomada. A Dona Maria recebe uma notificação no celular com um botão "Tomei". Se ela não confirmar, a IA liga para ela. Se mesmo assim não houver confirmação, a família é avisada.

Projeto do Hack Brasil 2026, trilha Saúde e bem-estar. Toda a demonstração usa dados fictícios. O Recuidado não faz diagnóstico, não recomenda tratamento e não altera dose.

- Demo: https://recuidado.com.br
- Contexto completo do projeto: [docs/context.md](docs/context.md)
- Painel de monitoria ao vivo (público, sem login): https://us.posthog.com/shared/agEAVqAn6xCM9GgdRycesljavVRvLg
- Como a monitoria funciona: [docs/monitoring.md](docs/monitoring.md)

## O que já funciona em produção

- **Receita lida por IA.** A família fotografa a receita e o Claude devolve cada remédio, dose e horário. A família revisa antes de salvar.
- **Lembrete no celular.** Notificação push no horário, com o botão "Tomei" na tela da Dona Maria.
- **Ligação de voz de verdade.** Sem confirmação, a IA liga para o telefone dela pela rede telefônica comum, pergunta se tomou e como ela está. Não precisa de app nem de internet do lado dela.
- **Família avisada.** Sem confirmação, ou se ela disser que não está bem, os filhos recebem o aviso na hora.
- **O que é grátis e onde.** Cada remédio é cruzado com a lista do Farmácia Popular, com o REMUME das UBS de São Paulo e com o Alto Custo, e a família vê as farmácias credenciadas mais perto.
- **MCP para qualquer assistente de IA.** Claude, ChatGPT ou outro agente consulta o plano, as doses e os avisos da família por conversa. Ver [Servidor MCP](#servidor-mcp).
- **Monitoria completa.** Logs, erros, eventos, traces da IA e replay das telas em um só lugar (PostHog).

## Impacto

- **32,1 milhões de brasileiros têm 60 anos ou mais**, 15,8% da população ([Censo 2022, IBGE](https://agenciagov.ebc.com.br/noticias/202310/brasileiros-com-60-anos-ou-mais-superam-32-milhoes-de-pessoas-mdhc-reforca-importancia-do-cuidado-e-respeito-com-essa-faixa-etaria)).
- **93% dos idosos usam ao menos um remédio de uso contínuo e 18% usam cinco ou mais** ([PNAUM, Ramos et al., Rev Saúde Pública 2016](https://revistas.usp.br/rsp/en/article/view/126591)).
- **30,8% dos adultos com doença crônica no Brasil têm baixa adesão ao tratamento** ([PNAUM, Tavares et al., Rev Saúde Pública 2016](https://scielosp.org/article/rsp/2016.v50suppl2/10s)). Lembrar de tomar é uma das barreiras medidas.
- **Só 50% dos pacientes crônicos seguem o tratamento nos países desenvolvidos**, e menos nos países em desenvolvimento ([OMS, 2003](https://www.who.int/news/item/01-07-2003-failure-to-take-prescribed-medicine-for-chronic-diseases-is-a-massive-world-wide-problem)).
- **Mediana de 4,29% das internações hospitalares está associada a não adesão a remédios** (revisão de 24 estudos, [BMJ Quality & Safety 2018](https://qualitysafety.bmj.com/content/27/11/902.abstract)).
- **40% das pessoas que moram sozinhas no Brasil têm 60 anos ou mais** ([PNAD Contínua 2025, IBGE](https://istoedinheiro.com.br/cresce-numero-de-brasileiros-que-vivem-sozinhos-revela-ibge)).
- **O Farmácia Popular atendeu mais de 24 milhões de pessoas em 2024 e hoje entrega os 41 itens do catálogo de graça** ([Agência Gov, 2025](https://agenciagov.ebc.com.br/noticias/202502/farmacia-popular-beneficiou-mais-de-24-milhoes-de-brasileiros-em-2024-maior-numero-da-serie-historica)).

Todos os números, o contexto de cada um e os que deixamos de fora por falta de fonte confiável estão em [docs/impact.md](docs/impact.md).

## Arquitetura

```mermaid
flowchart LR
  subgraph pessoas [Pessoas]
    F[Família<br/>celular ou computador]
    M[Dona Maria<br/>celular]
    T[Dona Maria<br/>telefone]
  end

  subgraph app [Recuidado]
    W[apps/web<br/>Next.js 16 PWA]
    A[apps/api<br/>NestJS 12]
    V[apps/voice<br/>agente de voz]
    X[apps/mcp<br/>servidor MCP]
    K[Asterisk<br/>ponte SIP]
    P[(PostgreSQL)]
    R[(Redis<br/>fila BullMQ)]
  end

  subgraph ext [Serviços externos]
    C[Claude Opus 5.5<br/>leitura da receita]
    G[OpenAI GPT-Live<br/>voz em tempo real]
    N[Nvoip<br/>operadora SIP]
    H[PostHog<br/>monitoria]
  end

  F --> W
  F -- assistente de IA --> X
  X --> A
  M --> W
  W --> A
  A --> P
  A --> R
  A --> C
  A -- push --> M
  A -- pede ligação --> V
  V --> G
  G -- SIP TLS/SRTP --> K
  K -- SIP G.711 --> N
  N --> T
  V -- resultado --> A
  W -.-> H
  A -.-> H
  V -.-> H
```

| Parte | O que faz | Tecnologia |
| --- | --- | --- |
| `apps/web` | App instalável (PWA). A família cadastra a Dona Maria, lê a receita e acompanha as doses. A Dona Maria vê o remédio da hora e confirma com um toque. | Next.js 16, React 19, Tailwind 4, Web Push |
| `apps/api` | Família, remédios, doses, leitura de receita e escalonamento. Agenda lembrete, ligação e aviso em uma fila. | NestJS 12, PostgreSQL, Drizzle, Redis, BullMQ |
| `apps/voice` | Liga para a Dona Maria, conversa por voz e devolve o resultado para a API. | OpenAI GPT-Live por SIP, Asterisk, Nvoip |
| `apps/mcp` | Servidor MCP sobre a API: qualquer assistente de IA consulta o plano, as doses, os avisos e onde o remédio é grátis. | MCP TypeScript SDK v2, Streamable HTTP |
| `packages/prescription-reader` | Leitura de receita (inclusive manuscrita) com saída estruturada. | Claude Opus 5.5 |
| `packages/data` | Coleta e cruzamento de dados públicos de remédios e farmácias. | Scripts Node, Firecrawl |
| `packages/telemetry` | Eventos, erros, traces de IA e exportação de logs para o PostHog. | posthog-node, OTLP |

## Servidor MCP

Endereço: `https://mcp.recuidado.com.br/mcp` (Streamable HTTP, sem login). Sem `familyId`, usa a família de demonstração.

| Ferramenta | O que faz |
| --- | --- |
| `get_care_plan` | Remédios, horários, onde cada um é grátis (Farmácia Popular, UBS), Alto Custo, custo do mês e comprimidos restantes |
| `get_today_doses` | Doses de hoje: tomada, pendente ou perdida, como foi confirmada e se a família foi avisada |
| `confirm_dose` | Marca uma dose de hoje como tomada, igual ao botão "Tomei" |
| `list_family_alerts` | Avisos enviados à família: dose não confirmada, não está bem, remédio acabando |
| `find_free_medicine` | Busca um remédio e diz, por dosagem, onde é grátis e se entra no Alto Custo |

O telefone nunca sai nas respostas, e o servidor não dá conselho clínico. Detalhes em [apps/mcp/README.md](apps/mcp/README.md).

**Como conectar.** No Claude: Configurações, Conectores, Adicionar conector personalizado, URL acima. No Claude Code: `claude mcp add --transport http recuidado https://mcp.recuidado.com.br/mcp`.

**Casos de uso**

1. **Pergunta rápida no celular.** O filho pergunta ao Claude ou ao ChatGPT, por texto ou voz, até dirigindo: "a mãe tomou o remédio da pressão hoje?".
2. **Resumo automático.** Uma tarefa agendada no assistente, todo dia às 21h: "como foram as doses da mãe hoje e teve algum aviso?". O resumo chega sem abrir o app.
3. **Na consulta médica.** "Liste os remédios e horários da minha mãe." O assistente monta a lista para mostrar ao médico.
4. **Receita nova ou balcão da farmácia.** "Atorvastatina 20 mg é grátis?" A resposta diz se é grátis no Farmácia Popular, na UBS ou se entra no Alto Custo.
5. **Ela ligou e disse que tomou.** "Marca que ela tomou o das 8." A dose é confirmada e a ligação e o aviso daquela dose são cancelados.
6. **Agenda.** "Coloque os horários de remédio da mãe no meu Google Agenda." O assistente lê o Recuidado e grava na agenda do filho.
7. **Lista de compras.** "O que está acabando?" O que estiver acabando vai para a lista no Notion, no Todoist ou nas notas.
8. **Grupo da família.** O assistente escreve o resumo da semana para os irmãos, e o filho só envia.

Os casos 6 a 8 usam o conector do Recuidado junto com outro conector do mesmo assistente (agenda, notas). O Recuidado não acessa esses serviços.

## Fluxo de uma dose

```mermaid
sequenceDiagram
  autonumber
  participant Fila as API (fila)
  participant Maria as Dona Maria
  participant Voz as Agente de voz
  participant Familia as Família

  Fila->>Maria: Push no horário: "Hora do remédio"
  alt Ela toca em "Tomei"
    Maria->>Fila: Dose confirmada
  else 15 minutos sem resposta
    Fila->>Voz: Ligar para a Dona Maria
    Voz->>Maria: "A senhora já tomou o remédio?"
    Maria->>Voz: Responde por voz
    Voz->>Fila: Tomou, não tomou ou não atendeu
    opt Não tomou, não atendeu ou disse que não está bem
      Fila->>Familia: Aviso no celular
    end
  end
```

Os tempos são configuráveis (`DOSE_CALL_AFTER_MINUTES` e `DOSE_ALERT_AFTER_MINUTES`). Doses no mesmo horário são confirmadas juntas.

Modo demo: na tela Hoje da família, "Demo em 2 minutos" (`/family/demo`) cria uma dose extra de agora e roda esse mesmo fluxo com esperas em segundos (`DEMO_CALL_AFTER_SECONDS` e `DEMO_ALERT_AFTER_SECONDS`): lembrete, ligação de verdade e aviso para a família. A tela mostra cada passo e o que foi dito na ligação. A agenda normal não muda, e os eventos dessa dose vão para o PostHog com `demo: true`. `DEMO_RUN_ENABLED=false` desliga o botão.

## Resultados medidos

| O quê | Resultado | Como medir de novo |
| --- | --- | --- |
| Leitura de receita (3 receitas sintéticas, uma manuscrita) | 3 de 3 corretas, de 12 a 16 s cada, cerca de US$ 0,06 por receita | `pnpm prescription:eval` |
| Ligação de voz | Ligação real ponta a ponta para um celular, com confirmação da dose por voz | `POST /demo/missed-dose` na API |
| Qualidade do código | Lint, testes e build em todos os pacotes a cada push | [CI](https://github.com/lucianoiw/recuidado/actions/workflows/ci.yml) |

## Monitoria

Tudo vai para o PostHog: logs de todos os serviços (que sobrevivem a deploy e restart), erros com stack trace, uma linha por requisição HTTP, eventos de produto (lembrete, dose confirmada, ligação, família avisada), cada chamada de IA com modelo, latência, tokens e custo, e o replay das telas com os campos mascarados.

O painel mostra adesão às doses, o funil do lembrete até o "Tomei", ligações por resultado, latência da IA e erros por serviço. Um alerta por e-mail dispara quando aparece um erro novo ou quando uma ligação falha. A transcrição da ligação não vai para o PostHog: ela fica só no Postgres.

[Abrir o painel ao vivo](https://us.posthog.com/shared/agEAVqAn6xCM9GgdRycesljavVRvLg) (público, sem login). Detalhes em [docs/monitoring.md](docs/monitoring.md).

## Dados públicos

| Fonte | Uso |
| --- | --- |
| Farmácia Popular (Ministério da Saúde) | Remédios gratuitos e farmácias credenciadas |
| CMED (Anvisa) | Preço máximo ao consumidor, usado como teto |
| CNES (DataSUS) | Farmácias e UBS perto da Dona Maria |
| REMUME (Prefeitura de São Paulo) | Remédios entregues nas UBS |
| CEAF (Secretaria da Saúde de SP) | Remédios do Alto Custo |

A região da demo é São Paulo capital. Detalhes em [packages/data/README.md](packages/data/README.md).

## Segurança e privacidade

- Toda a demo usa dados sintéticos. A Dona Maria é uma personagem.
- Segredos só em variáveis de ambiente, nunca no repositório ([.env.example](.env.example) lista os nomes).
- Dado de saúde é sensível (LGPD, art. 11). Por isso a pessoa cuidada consente: a família declara no cadastro e ela confirma no primeiro acesso ao app dela, com "Aceito" ou "Não quero". Sem aceite, o Recuidado não liga.
- Guardamos o mínimo (sem CPF, endereço completo ou diagnóstico, sem áudio). O texto das ligações é apagado depois de 90 dias.
- Quem fez o cadastro baixa todos os dados da família ou apaga tudo em Família, Seus dados. O aviso de privacidade está em [/privacidade](https://recuidado.com.br/privacidade).
- O PostHog não recebe nomes de remédio nem transcrições, e o replay das telas esconde todo o texto.
- A assistente da ligação diz que é uma assistente virtual na primeira frase.
- O agente não faz diagnóstico, não recomenda tratamento e não muda dose. A família revisa a leitura da receita antes de salvar.
- Antes de ter usuário real ainda faltaria: login de verdade (hoje o id salvo no aparelho identifica a família), retenção zero nos provedores de IA e um canal de contato do encarregado de dados.

## Rodar localmente

Requisitos: Node 22+, pnpm 10 e Docker.

```bash
cp .env.example .env
pnpm install
pnpm db:up        # Postgres e Redis locais em Docker
pnpm dev          # web em http://localhost:3000, api em http://localhost:4000
```

Testes, lint e build:

```bash
pnpm lint && pnpm test && pnpm build
```

## Deploy

No Coolify, com um recurso para cada parte (web, api, voz, MCP, Asterisk, Postgres e Redis). Cada push na `main` faz o deploy automático. Os detalhes estão em [deploy/README.md](deploy/README.md).

## Licença

[MIT](LICENSE)
