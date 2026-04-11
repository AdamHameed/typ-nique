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
RUN pnpm exec turbo run build --filter=@typ-nique/api
RUN pnpm --filter @typ-nique/api deploy --prod /prod/api
RUN generated_prisma_client="$(find /app/node_modules -path '*/node_modules/.prisma/client' -type d | head -n 1)" \
  && deployed_prisma_client="$(find /prod/api/node_modules -path '*/node_modules/.prisma/client' -type d | head -n 1)" \
  && test -n "$generated_prisma_client" \
  && test -n "$deployed_prisma_client" \
  && rm -rf "$deployed_prisma_client" \
  && mkdir -p "$(dirname "$deployed_prisma_client")" \
  && cp -R "$generated_prisma_client" "$deployed_prisma_client"

FROM node:22-bookworm-slim AS runtime

LABEL org.opencontainers.image.title="typ-nique-api"
LABEL org.opencontainers.image.description="Typ-Nique Fastify API service"

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY --from=build /prod/api ./
COPY --from=build /app/data ./data

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const port=process.env.PORT||4000; fetch(`http://127.0.0.1:${port}/health`, { cache: 'no-store' }).then((response)=>process.exit(response.ok?0:1)).catch(()=>process.exit(1))"

USER node

CMD ["node", "dist/server.js"]
