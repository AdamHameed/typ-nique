FROM rust:1-bookworm AS typst-builder

RUN --mount=type=cache,target=/usr/local/cargo/registry \
  --mount=type=cache,target=/usr/local/cargo/git \
  cargo install typst-cli --version 0.14.2 --locked

FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable

WORKDIR /app

COPY --from=typst-builder /usr/local/cargo/bin/typst /usr/local/bin/typst

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

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @typ-nique/db generate

ENV NODE_ENV=production
ENV PORT=4100

EXPOSE 4100

CMD ["pnpm", "exec", "tsx", "apps/worker/src/index.ts"]
