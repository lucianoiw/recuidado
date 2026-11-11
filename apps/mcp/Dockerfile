# Build from the repo root: docker build -f apps/mcp/Dockerfile .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/mcp/package.json apps/mcp/
# Workspace library used by mcp. Its "prepare" script builds dist/ on install.
COPY packages/telemetry packages/telemetry
RUN pnpm install --frozen-lockfile --filter @recuidado/mcp...
COPY apps/mcp apps/mcp
RUN pnpm --filter @recuidado/mcp build \
  && pnpm deploy --filter @recuidado/mcp --prod --legacy /out \
  && cp -r apps/mcp/dist /out/

FROM node:22-alpine
ENV NODE_ENV=production PORT=7000
WORKDIR /app
COPY --from=build /out .
USER node
EXPOSE 7000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:7000/health || exit 1
CMD ["node", "dist/server.js"]
