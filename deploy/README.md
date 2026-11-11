# Deploy

Coolify project "Recuidado", branch `main`, server 82.25.75.144. One resource per service.

| Service in Coolify | Type | Source | Domain:port |
| --- | --- | --- | --- |
| `recuidado/web` | Dockerfile | `/apps/web/Dockerfile` | https://recuidado.com.br:3000, https://www.recuidado.com.br:3000 |
| `recuidado/api` | Dockerfile | `/apps/api/Dockerfile` | https://api.recuidado.com.br:4000 |
| `recuidado/voice` | Dockerfile | `/apps/voice/Dockerfile` | https://voz.recuidado.com.br:5000 |
| `recuidado/asterisk` | Docker Compose (Base Directory `/deploy/asterisk`) | `/docker-compose.yml` | host network (5061/tcp, 10000-10200/udp) |
| `recuidado/postgresql` | Coolify database | | internal |
| `recuidado/redis` | Coolify database | | internal |

Dockerfile resources use Base Directory `/` (build context is the repo root). Asterisk uses `/deploy/asterisk`, because Coolify resolves the compose build context from the base directory.

- `api`: `DATABASE_URL` and `REDIS_URL` use the internal URLs of the Coolify databases. Migrations run on boot.
- `api` and `web`: Web Push uses one VAPID key pair. `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` on api; the same public key as `NEXT_PUBLIC_VAPID_PUBLIC_KEY` on web, marked as build variable (Next inlines it at build time).
- `voice`: keeps the domain `voz.recuidado.com.br` so Traefik issues the certificate that `asterisk` reads from `/data/coolify/proxy/acme.json`. Give it a longer stop grace period so a call in progress is not cut.
- Firewall (Hostinger panel): open 5061/tcp and 10000-10200/udp for Asterisk.
- Monitoring: PostHog project "Recuidado". `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` on api and voice (runtime). `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` on web, marked as build variables. Container logs vanish on every redeploy; PostHog Logs keeps them. See `docs/monitoring.md`.
- Variables: see `.env.example` (and `apps/voice/.env.example`). Secrets never go in the repo. Per resource:

| Resource | Required | Optional (default in code) |
| --- | --- | --- |
| `api` | `DATABASE_URL`, `REDIS_URL`, `WEB_URL`, `VOICE_URL`, `VOICE_API_TOKEN`, `ANTHROPIC_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `POSTHOG_PROJECT_TOKEN` | `PORT`, `VAPID_SUBJECT`, `POSTHOG_HOST`, `DOSE_CALL_AFTER_MINUTES`, `DOSE_ALERT_AFTER_MINUTES`, `CALL_DAILY_LIMIT_PER_FAMILY`, `CALL_DAILY_LIMIT_TOTAL`, `DEMO_RUN_ENABLED`, `DEMO_RUN_LOCK_SECONDS`, `DEMO_CALL_AFTER_SECONDS`, `DEMO_ALERT_AFTER_SECONDS`, `LOW_STOCK_DAYS`, `PRESCRIPTION_MODEL`, `PRESCRIPTION_LIMIT_PER_IP`, `PRESCRIPTION_LIMIT_PER_FAMILY`, `PRESCRIPTION_LIMIT_TOTAL`, `TRUST_PROXY_HOPS` |
| `voice` | `OPENAI_API_KEY`, `OPENAI_SIP_PASSWORD`, `SIP_PROVIDER_URL`, `SIP_CALLER_NUMBER`, `CALL_ALLOWED_NUMBERS`, `VOICE_API_TOKEN`, `API_URL`, `POSTHOG_PROJECT_TOKEN` | `PORT`, `OPENAI_SIP_USERNAME`, `OPENAI_LIVE_MODEL`, `OPENAI_LIVE_VOICE`, `OPENAI_DELEGATE_MODEL`, `CALL_MAX_SECONDS`, `POSTHOG_HOST` |
| `asterisk` | `SIP_DOMAIN`, `OPENAI_SIP_USERNAME`, `OPENAI_SIP_PASSWORD`, `NVOIP_SIP_USER`, `NVOIP_SIP_PASSWORD`, `CALL_ALLOWED_NUMBERS`, `PUBLIC_IP` | `NVOIP_SIP_HOST`, `SIP_TLS_PORT`, `NVOIP_LOCAL_PORT`, `RTP_START`, `RTP_END` |
| `web` (build variables) | `NEXT_PUBLIC_API_URL` | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST` |

`docker-compose.dev.yml` at the root is local infra only (Postgres and Redis).
