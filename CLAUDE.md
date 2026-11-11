# Recuidado: notes for coding agents

Read `docs/context.md` first: product, Hack Brasil rules and scope.

## Rules that cannot be broken

- Demo data is always synthetic. Never commit real names, phones, addresses or prescriptions.
- Secrets only in environment variables. Document every new variable in `.env.example`.
- No WhatsApp, no real medicine purchase, no clinical decisions (no dose changes, no treatment advice).
- Everything must be committed before 30/11/2026 23:59 (Brasília). No commits after that until the final.

## Conventions

- Folders, packages, tables, identifiers, comments, commits and PRs in English. Only text the user reads is in Portuguese (pt-BR).
- Use the latest stable version of each package.
- pnpm workspaces: `apps/*` (deployable services) and `packages/*` (shared libraries). Package names use the `@recuidado/` scope.
- `apps/web`: Next.js 16 App Router, PWA. See `apps/web/AGENTS.md`: this Next.js is newer than your training data.
- `apps/api` (HTTP) and `apps/worker` (doses queue, no HTTP) share code only through `packages/core` (`@recuidado/core`). `apps/api`: NestJS 12, ESM (relative imports end in `.js`), Vitest, Drizzle ORM on Postgres, BullMQ on Redis. See `apps/api/AGENTS.md`.
- Schema changes: edit `packages/core/src/db/schema.ts`, then `pnpm --filter @recuidado/api db:generate`. Migrations run on API boot.
- New deployable service: add `apps/<name>/Dockerfile` (built from the repo root). Each one is its own Coolify resource (`recuidado/<name>`), see `deploy/README.md`.

## Checks before pushing

```
pnpm install
pnpm lint && pnpm test && pnpm build
```
