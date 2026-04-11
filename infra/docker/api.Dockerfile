FROM node:22-bookworm-slim AS base

LABEL org.opencontainers.image.title="typ-nique-api"
LABEL org.opencontainers.image.description="Typ-Nique Fastify API service"

ENV PNPM_HOME="/pnpm"
ENV PNPM_STORE_DIR="/pnpm/store"
ENV PATH="$PNPM_HOME:$PATH"

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && pnpm config set store-dir "$PNPM_STORE_DIR"

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/validation/package.json packages/validation/package.json
COPY packages/checker/package.json packages/checker/package.json
COPY packages/typst-utils/package.json packages/typst-utils/package.json
COPY prisma/package.json prisma/package.json

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build

COPY . .

RUN pnpm --filter @typ-nique/db generate
RUN pnpm --filter @typ-nique/api build
RUN pnpm prune --prod

FROM node:22-bookworm-slim AS runtime

LABEL org.opencontainers.image.title="typ-nique-api"
LABEL org.opencontainers.image.description="Typ-Nique Fastify API service"

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/packages ./packages
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/data ./data

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const port=process.env.PORT||4000; fetch(`http://127.0.0.1:${port}/health`, { cache: 'no-store' }).then((response)=>process.exit(response.ok?0:1)).catch(()=>process.exit(1))"

USER node

CMD ["node", "apps/api/dist/server.js"]
