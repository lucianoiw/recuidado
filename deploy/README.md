# Deploy

Coolify project "Recuidado", branch `main`, server 82.25.75.144. One resource per service.

| Service in Coolify | Type | Source | Domain:port |
| --- | --- | --- | --- |
| `recuidado/web` | Dockerfile | `/apps/web/Dockerfile` | https://recuidado.com.br:3000, https://www.recuidado.com.br:3000 |
| `recuidado/api` | Dockerfile | `/apps/api/Dockerfile` | https://api.recuidado.com.br:4000 |
| `recuidado/voice` | Dockerfile | `/apps/voice/Dockerfile` | https://voz.recuidado.com.br:5000 |
| `recuidado/asterisk` | Docker Compose | `/deploy/asterisk/docker-compose.yml` | host network (5061/tcp, 10000-10200/udp) |
| `recuidado/postgresql` | Coolify database | | internal |
| `recuidado/redis` | Coolify database | | internal |

All Dockerfile resources use Base Directory `/` (build context is the repo root).

- `api`: `DATABASE_URL` and `REDIS_URL` use the internal URLs of the Coolify databases. Migrations run on boot.
- `voice`: keeps the domain `voz.recuidado.com.br` so Traefik issues the certificate that `asterisk` reads from `/data/coolify/proxy/acme.json`. Give it a longer stop grace period so a call in progress is not cut.
- Firewall (Hostinger panel): open 5061/tcp and 10000-10200/udp for Asterisk.
- Variables: see `.env.example`. Secrets never go in the repo.

`docker-compose.dev.yml` at the root is local infra only (Postgres and Redis).
