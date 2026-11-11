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
- Variables: see `.env.example`. Secrets never go in the repo.

`docker-compose.dev.yml` at the root is local infra only (Postgres and Redis).
