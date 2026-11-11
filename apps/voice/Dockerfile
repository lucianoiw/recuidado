# Build from the repo root: docker build -f apps/voice/Dockerfile .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/voice/package.json apps/voice/
# Workspace library used by voice. Its "prepare" script builds dist/ on install.
COPY packages/telemetry packages/telemetry
RUN pnpm install --frozen-lockfile --filter @recuidado/voice...
COPY apps/voice apps/voice
RUN pnpm --filter @recuidado/voice build \
  && pnpm deploy --filter @recuidado/voice --prod --legacy /out \
  && cp -r apps/voice/dist /out/

FROM node:22-alpine
ENV NODE_ENV=production PORT=5000
WORKDIR /app
COPY --from=build /out .
# Recorded greetings; mount a volume here so they survive redeploys (see deploy/README.md).
RUN mkdir -p /data/greetings && chown node:node /data/greetings
ENV GREETING_CACHE_DIR=/data/greetings
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:5000/health || exit 1
CMD ["node", "dist/server.js"]
