FROM node:22-bullseye-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

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

RUN pnpm install --no-frozen-lockfile

COPY . .

RUN pnpm --filter @typ-nique/db generate

EXPOSE 4000

CMD ["pnpm", "--filter", "@typ-nique/api", "dev"]
