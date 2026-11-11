# Monitoria

Painel público, sem login: https://us.posthog.com/shared/agEAVqAn6xCM9GgdRycesljavVRvLg

Tudo vai para o projeto **Recuidado** no PostHog (org 89Dev, região US). Um lugar só para logs, erros, acessos, eventos de produto, traces de IA e replay das telas.

## Por que

Os logs do Coolify ficam dentro do container. Cada deploy cria um container novo e o log do anterior some. O PostHog guarda os logs de todos os serviços, com busca e filtro, mesmo depois de deploy ou restart.

## O que cada serviço manda

| Serviço | Logs | Erros | Eventos | IA |
| --- | --- | --- | --- | --- |
| `web` | `console.*` do navegador | exceções do navegador | page views, cliques, web vitals, replay das telas (todo texto e campo mascarados) e eventos do app | |
| `api` | todo log do Nest e uma linha por requisição HTTP (método, rota, status, tempo) | 5xx, falhas de job da fila e falha no boot | lembrete, dose confirmada, dose perdida, família avisada, ligação pedida, receita lida e salva | leitura da receita com Claude (`$ai_generation`: modelo, tokens, latência, custo) |
| `voice` | todo log da ligação | falha ao iniciar ligação e erro interno | ligação iniciada, chamando, atendida, encerrada (resultado, duração), recusada | ligação do agente de voz GPT-Live (`$ai_generation`) |

O web manda o id da sessão para a API (`tracing_headers`). Assim cada log de acesso e cada erro da API abre o replay da tela que fez a chamada. Os eventos da Dona Maria usam o id dela, então a pessoa no PostHog mostra a linha do tempo inteira: lembrete, ligação, "Tomei".

## Eventos de produto

| Evento | Origem | Propriedades principais |
| --- | --- | --- |
| `dose_reminder_sent` | api | `dose_id`, `pushes_delivered` |
| `dose_confirmed` | api | `dose_id`, `via` (`app` ou `voice`), `minutes_since_scheduled` |
| `dose_missed` | api | `dose_id`, `minutes_since_scheduled` |
| `family_alerted` | api | `dose_id`, `caregivers`, `pushes_delivered` |
| `dose_call_requested` / `dose_call_failed` | api | `dose_id`, `call_id` |
| `dose_voice_result` | api | `dose_id`, `outcome`, `applied` |
| `prescription_read` / `prescription_read_failed` | api | `items`, `model`, tokens, `latency_seconds` |
| `prescription_confirmed` | api | `medications`, `daily_doses` |
| `push_subscribed` | api | `push_service` |
| `consent_given` / `consent_revoked` | api | `source` |
| `family_exported`, `family_deleted`, `transcripts_purged` | api | `calls`, `retention_days` |
| `call_started`, `call_ringing`, `call_answered` | voice | `dose_id`, `call_id` |
| `call_ended` | voice | `outcome`, `confirmed`, `duration_seconds`, `error` |
| `call_refused`, `call_start_failed` | voice | `dose_id`, motivo |
| `dose_confirm_tapped`, `prescription_upload_started`, `prescription_reviewed`, `prescription_saved`, `notifications_permission` | web | |
| `service_started` | api, voice | |

LGPD: nenhum evento leva nome de remédio, transcrição ou o que ela disse. A transcrição fica só no Postgres e é esvaziada depois de `VOICE_TRANSCRIPT_RETENTION_DAYS` (90). O trace de IA da receita leva só quantos remédios foram lidos, não a leitura. O replay esconde todo o texto da tela (`maskTextSelector: "*"`). Exceção: `demo_run_started` leva o nome do remédio da família demo, que é sintética.

## Variáveis

| Recurso no Coolify | Variáveis |
| --- | --- |
| `recuidado/api`, `recuidado/voice` | `POSTHOG_PROJECT_TOKEN`, `POSTHOG_HOST` (runtime) |
| `recuidado/web` | `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST` (build) |

Sem o token, nada é enviado e os logs continuam só no stdout.

## Código

- `packages/telemetry`: cliente comum de api e voice (eventos, exceções, `$ai_generation` e exportador de logs OTLP).
- `apps/api/src/telemetry`: logger do Nest, log de acesso e filtro de exceções.
- `apps/app/src/instrumentation-client.ts` e `apps/app/src/lib/analytics.ts`.
