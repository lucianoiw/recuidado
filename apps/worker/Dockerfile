# The doses queue worker: its own small app, no HTTP. Shares code with the API only through @recuidado/core.
# Build from the repo root: docker build -f apps/worker/Dockerfile .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/worker/package.json apps/worker/
# Workspace libraries used by the worker. Their "prepare" script builds dist/ on install.
COPY packages/telemetry packages/telemetry
COPY packages/data packages/data
COPY packages/core packages/core
RUN pnpm install --frozen-lockfile --filter @recuidado/worker...
COPY apps/worker apps/worker
RUN pnpm --filter @recuidado/worker build \
  && pnpm deploy --filter @recuidado/worker --prod --legacy /out \
  && cp -r apps/worker/dist /out/

FROM node:22-alpine
ENV NODE_ENV=production TELEMETRY_SERVICE=worker
WORKDIR /app
COPY --from=build /out .
USER node
# Healthy while the heartbeat file is younger than 2 minutes.
HEALTHCHECK --interval=30s --timeout=5s CMD find /tmp/worker-heartbeat -mmin -2 | grep -q . || exit 1
CMD ["node", "dist/main.js"]
