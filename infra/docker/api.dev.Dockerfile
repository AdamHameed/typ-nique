# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/validation/package.json packages/validation/package.json
COPY packages/checker/package.json packages/checker/package.json
COPY packages/typst-utils/package.json packages/typst-utils/package.json
COPY prisma/package.json prisma/package.json
COPY prisma/schema.prisma prisma/schema.prisma

RUN --mount=type=cache,id=typnique-pnpm-store,target=/pnpm/store \
  pnpm install --no-frozen-lockfile

RUN pnpm --filter @typ-nique/db generate

EXPOSE 4000

CMD ["pnpm", "--filter", "@typ-nique/api", "dev"]
