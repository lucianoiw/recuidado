# Recuidado

Agente de IA que cuida do remédio do idoso junto com a família.

O Recuidado lê a receita, mostra o que é de graça no Farmácia Popular, cota o resto com o teto da CMED, divide o custo entre os filhos e garante que a dose seja tomada. A Dona Maria recebe uma notificação no celular com um botão "Tomei". Se ela não confirmar, a IA liga para ela. Se mesmo assim não houver confirmação, a família é avisada.

Projeto do Hack Brasil 2026, trilha Saúde e bem-estar. Toda a demonstração usa dados fictícios. O Recuidado não faz diagnóstico, não recomenda tratamento e não altera dose.

- Demo: https://recuidado.com.br
- Contexto completo do projeto: [docs/context.md](docs/context.md)

## Como funciona

| Parte | O que faz | Tecnologia |
| --- | --- | --- |
| `apps/web` | App web instalável (PWA). A família faz login e acompanha remédios, custos e doses. A Dona Maria vê o remédio da hora e confirma com um toque. | Next.js 16, React 19, Tailwind 4 |
| `apps/api` | Plano de cuidado, doses, família, divisão de custo e o MCP de cuidado do remédio. Agenda lembretes e escalonamento. | NestJS 12, PostgreSQL, Drizzle, Redis, BullMQ |
| `apps/voice` | Ligação de voz da IA para quem não respondeu à notificação. | Em desenvolvimento |
| `packages/*` | Leitura de receita por IA e coleta de dados públicos. | Em desenvolvimento |

Fluxo de uma dose:

1. No horário, a API envia uma notificação push para a Dona Maria.
2. Sem confirmação em 15 minutos, a API pede ao serviço de voz que ligue para ela.
3. Sem confirmação depois da ligação, a família recebe um alerta.

Os tempos são configuráveis (`DOSE_CALL_AFTER_MINUTES` e `DOSE_ALERT_AFTER_MINUTES`).

## Dados públicos

- Lista de medicamentos gratuitos e farmácias credenciadas do Farmácia Popular (Ministério da Saúde)
- Preço máximo de medicamentos (CMED, Anvisa)
- Estabelecimentos de saúde (CNES, DataSUS)

## Rodar localmente

Requisitos: Node 22+, pnpm 10 e Docker.

```bash
cp .env.example .env
pnpm install
pnpm db:up        # Postgres e Redis em Docker
pnpm dev          # web em http://localhost:3000, api em http://localhost:4000
```

Testes, lint e build:

```bash
pnpm lint && pnpm test && pnpm build
```

## Deploy

O deploy é feito no Coolify com o `docker-compose.yml` da raiz (web, api, Postgres e Redis). Os domínios são configurados no Coolify: `recuidado.com.br` para o serviço `web` e `api.recuidado.com.br` para o serviço `api`. Os segredos ficam nas variáveis de ambiente do Coolify, nunca no repositório. A lista completa está em [.env.example](.env.example).

## Licença

[MIT](LICENSE)
