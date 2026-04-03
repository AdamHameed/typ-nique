# Typ-Nique

Typ-Nique is a Typst typesetting game inspired by TeXnique. Players race to reproduce rendered Typst snippets as quickly and accurately as possible, with an answer checker that can validate exact matches, normalized source matches, alternate answers, and eventually rendered SVG equivalence.

## Stack

- Next.js + TypeScript frontend
- Fastify API with TypeScript
- PostgreSQL + Prisma
- Redis + BullMQ
- Dedicated worker for Typst rendering and answer checking
- Docker and Docker Compose

## Monorepo layout

```text
apps/
  web/      Next.js app
  api/      Fastify API
  worker/   BullMQ render/check worker
packages/
  checker/      checker pipeline logic
  typst-utils/  SVG normalization and Typst helpers
  types/        shared domain types
  validation/   shared Zod schemas
prisma/         Prisma schema and seed data
infra/          Dockerfiles and docker-compose
docs/           product and engineering docs
```

## Quick start

1. Copy the environment file.

```bash
cp .env.example .env
```

2. Install dependencies.

```bash
pnpm install
```

3. Start local infrastructure.

```bash
docker compose -f infra/compose/docker-compose.yml up -d postgres redis
```

4. Generate the Prisma client and run migrations.

```bash
pnpm db:generate
pnpm db:migrate
```

5. Seed starter challenge data.

```bash
pnpm db:seed
```

6. Start the apps.

```bash
pnpm dev
```

Or start the full local stack in one terminal:

```bash
make dev
```

Useful shortcuts:

```bash
make setup
make dev-no-seed
make infra-down
make infra-reset
```

## Docker

Run the full stack:

```bash
docker compose -f infra/compose/docker-compose.yml up --build
```

Services:

- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## Current scaffold coverage

- Landing, play, results, and leaderboard pages
- Challenge, game session, and submission APIs
- Prisma schema and seed data
- Typst render/check worker skeleton
- Initial advanced checker pipeline structure
- Dockerfiles and Compose config

## Next implementation steps

- Add real auth
- Replace in-memory leaderboard reads with persisted score rollups
- Implement hardened Typst sandbox execution
- Add canonical SVG artifact storage
- Expand checker normalization and golden tests
