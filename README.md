# Typ-Nique

Typ-Nique is a Typst typing game inspired by TeXnique. The default local workflow runs the `web`, `api`, and `worker` apps on your machine, while PostgreSQL and Redis run in Docker.

## Local Setup

### Prerequisites

- Node.js 22+
- pnpm 9+
- Docker
- Typst CLI available on your `PATH`

Check that Typst is installed:

```bash
typst --version
```

### 1. Create your local env file

```bash
cp .env.example .env
```

The values in `.env.example` already work for a standard local setup, so most developers do not need to change anything.

### 2. Install dependencies

```bash
pnpm install
```

### 3. Start the local stack

```bash
pnpm dev
```

`pnpm dev` will:

- start PostgreSQL and Redis with Docker
- generate the Prisma client
- apply local Prisma migrations
- seed the database
- start the web app on `3000`
- start the API on `4000`
- start the worker on `4100`

### 4. Open the app

- Web: `http://localhost:3000`
- API health: `http://localhost:4000/health`
- Worker health: `http://localhost:4100/health`

## Common Commands

```bash
pnpm dev           # start the full local stack
pnpm dev:docker    # full clean Docker rebuild and restart
pnpm dev:no-seed   # start without reseeding the database
pnpm dev:reset     # wipe Docker volumes first, then start clean
pnpm stop          # stop local apps and Docker services, keep volumes
pnpm stop:reset    # stop everything and remove Docker volumes
```

Useful one-off commands:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm content:validate
pnpm content:render
pnpm content:seed
pnpm typecheck
```

## Project Layout

```text
apps/
  web/         Next.js frontend
  api/         Fastify API
  worker/      Typst render/check service

packages/
  checker/     answer checker and SVG comparison logic
  types/       shared TypeScript contracts
  typst-utils/ Typst/SVG helpers
  ui/          shared UI primitives
  validation/  shared Zod schemas

prisma/        Prisma schema, migrations, and seed code
data/          Challenge content packs
infra/         Docker, compose, and proxy config
docs/          Deployment and architecture notes
```

## Docker-Only Alternative

If you want to run the whole stack in containers instead of using `pnpm dev`, use:

```bash
pnpm dev:docker
```

That command does a full clean Docker restart:

- stops the current Docker stack
- removes Docker volumes for this project
- removes the app images
- rebuilds everything from scratch with `--no-cache`
- starts `web`, `api`, `worker`, `postgres`, and `redis`

The compose stack also runs a one-shot `setup` container first to generate Prisma, apply migrations, and seed the database.
That compose file is development-only and intentionally keeps bind mounts and `env_file` usage isolated from production deployment paths.

If you need to rerun the container bootstrap manually:

```bash
docker compose -f infra/compose/docker-compose.dev.yml run --rm setup
```

## Troubleshooting

- If `pnpm dev` says `.env` is missing, run `cp .env.example .env`.
- If the worker cannot render Typst, make sure `typst` is installed and available in your shell.
- If Docker reports a port conflict, stop the other service using that port before starting Typ-Nique.
- If you want a fully clean local reset, run `pnpm stop:reset` and then `pnpm dev:reset`.

## Docs

- [Challenge content system](/Users/adam/Downloads/Projects/typ-nique/docs/challenge-content-system.md)
- [Typst rendering service](/Users/adam/Downloads/Projects/typ-nique/docs/typst-rendering-service.md)
- [Advanced answer checker](/Users/adam/Downloads/Projects/typ-nique/docs/advanced-answer-checker.md)
- [Production security hardening](/Users/adam/Downloads/Projects/typ-nique/docs/production-security.md)
- [Railway deployment](/Users/adam/Downloads/Projects/typ-nique/docs/railway-deployment.md)
