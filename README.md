# Typ-Nique

Typ-Nique is a Typst typesetting game inspired by TeXnique. Players race to reproduce rendered Typst snippets as quickly and accurately as possible, with an answer checker that can validate exact matches, normalized source matches, alternate answers, and eventually rendered SVG equivalence.

## Stack

- Next.js + TypeScript frontend
- Fastify API with TypeScript
- PostgreSQL + Prisma
- Redis + BullMQ
- Dedicated worker for Typst rendering and answer checking
- DB-backed cookie authentication with guest-to-account upgrade
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

If you are running locally, keep `NEXT_PUBLIC_API_URL=http://localhost:4000`. The web client will use `localhost` in the browser so auth and guest cookies stay attached correctly, and it will automatically use `127.0.0.1` only for Next.js server-side fetches where macOS `localhost` can be flaky.

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

6. Start the full local stack with one command.

```bash
pnpm dev
```

That starts:
- PostgreSQL
- Redis
- API
- worker
- web app

You can still use `make` if you prefer:

```bash
make dev
```

Useful shortcuts:

```bash
make setup
make dev-no-seed
make infra-down
make infra-reset
pnpm dev:stack:no-seed
pnpm dev:stack:reset
pnpm dev:stop
pnpm dev:workspace
```

## Authentication

- Guest mode still works by default through a persistent guest cookie and `PlayerSession`.
- Registered users authenticate through DB-backed HTTP-only cookie sessions.
- Signing up or logging in from an existing guest browser upgrades the current guest history into the authenticated account.
- New auth routes:
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/logout`
  - `GET /api/v1/auth/session`
  - `GET /api/v1/auth/history`

After pulling auth changes, run:

```bash
pnpm db:generate
pnpm db:migrate
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

- Replace in-memory leaderboard reads with persisted score rollups
- Implement hardened Typst sandbox execution
- Add canonical SVG artifact storage
- Expand checker normalization and golden tests
