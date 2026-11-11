# Build from the repo root: docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
# Workspace libraries used by the api. Their "prepare" script builds dist/ on install.
COPY packages/prescription-reader packages/prescription-reader
COPY packages/data packages/data
COPY packages/telemetry packages/telemetry
RUN pnpm install --frozen-lockfile --filter @recuidado/api...
COPY apps/api apps/api
RUN pnpm --filter @recuidado/api build \
  && pnpm deploy --filter @recuidado/api --prod --legacy /out \
  && cp -r apps/api/dist apps/api/drizzle /out/

FROM node:22-alpine
ENV NODE_ENV=production PORT=4000
WORKDIR /app
COPY --from=build /out .
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:4000/health || exit 1
CMD ["node", "dist/main.js"]
