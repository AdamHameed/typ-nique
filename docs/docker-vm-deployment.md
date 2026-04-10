# Docker Deployment

## Services

- `web`: Next.js frontend
- `api`: Fastify application API
- `worker`: Typst render/check worker
- `postgres`: PostgreSQL
- `redis`: Redis for queues and caching

## Local development

Use [docker-compose.dev.yml](/Users/adam/Downloads/Projects/typ-nique/infra/compose/docker-compose.dev.yml) for local development. It is optimized for bind mounts, live reload, and container health checks, and should not be used as a production deployment template.

```bash
docker compose -f infra/compose/docker-compose.dev.yml up --build
```

## Production image strategy

Use the production Dockerfiles:

- [web.Dockerfile](/Users/adam/Downloads/Projects/typ-nique/infra/docker/web.Dockerfile)
- [api.Dockerfile](/Users/adam/Downloads/Projects/typ-nique/infra/docker/api.Dockerfile)
- [worker.Dockerfile](/Users/adam/Downloads/Projects/typ-nique/infra/docker/worker.Dockerfile)

Notes:

- `web` builds with Next.js standalone output and runs with `next start` style output.
- `api` builds first and starts from the compiled entrypoint through `tsx`, which keeps runtime aligned with the workspace package layout without booting directly from source.
- `worker` includes a Typst CLI binary built in a dedicated stage and copies it into the final runtime image.

## Environment variables

Start from [.env.example](/Users/adam/Downloads/Projects/typ-nique/.env.example).

Production-specific values to change:

- `NODE_ENV=production`
- `DATABASE_URL`
- `DIRECT_DATABASE_URL`
- `REDIS_URL`
- `WORKER_RENDER_URL`
- `WORKER_INTERNAL_TOKEN`
- `RENDER_ADMIN_TOKEN`
- `ALLOWED_BROWSER_ORIGINS` if browser traffic reaches `api` or the multiplayer gateway cross-origin
- `AUTH_COOKIE_NAME`
- `GUEST_COOKIE_NAME`
- `NEXT_PUBLIC_API_URL`

Recommended production values:

- `NEXT_PUBLIC_API_URL=https://typnique.example.com`
- `WORKER_RENDER_URL=http://worker:4100`
- keep `WORKER_INTERNAL_TOKEN` and `RENDER_ADMIN_TOKEN` long and random
- leave multiplayer diagnostics disabled unless you intentionally need them in production

## Volume strategy

Local development:

- bind mount the repo into `/app`
- named volumes for `node_modules`
- named volumes for PostgreSQL and Redis data
- worker `tmpfs` for `/tmp`

Production:

- persistent volume for PostgreSQL data
- persistent volume for Redis only if you want queue durability across restarts
- ephemeral root filesystem for `web`, `api`, and `worker`
- worker `tmpfs` for `/tmp`
- optional persistent volume for `storage` if you later store SVG artifacts outside the database

## Health checks

Recommended checks:

- `web`: `GET /api/health`
- `api`: `GET /health`
- `worker`: `GET /health`
- `postgres`: `pg_isready`
- `redis`: `redis-cli ping`

The local compose file already includes these.

## Reverse proxy

Use Caddy or Nginx in front of `web` and `api`.

Practical setup on a VM:

- expose only `80` and `443` publicly
- keep `api`, `worker`, `postgres`, and `redis` on an internal Docker network
- terminate TLS at the reverse proxy
- route browser traffic to `web`
- let `web` proxy `/api/v1/*` to `api` internally

Example:

- [Caddyfile.example](/Users/adam/Downloads/Projects/typ-nique/infra/proxy/Caddyfile.example)

## Resource limits

Small VM starting point:

- `web`: 256-512 MB RAM
- `api`: 256-512 MB RAM
- `worker`: 768 MB to 1.5 GB RAM
- `postgres`: 512 MB to 1 GB RAM
- `redis`: 128-256 MB RAM

Worker-specific guardrails:

- `TYPST_MAX_CONCURRENT_RENDERS=2`
- `TYPST_TIMEOUT_MS=4000`
- `TYPST_MAX_MEMORY_KB=524288`
- `tmpfs` mounted at `/tmp`
- `pids_limit` around `128`

## Migration and seed workflow

Do not use `prisma migrate dev` in production containers.

Use:

```bash
pnpm db:deploy
```

Recommended deployment order:

1. start `postgres` and `redis`
2. run `pnpm db:deploy`
3. run `pnpm db:seed` only for first-time bootstrap or explicit content refresh
4. start `api`, `worker`, and `web`

For repeat deploys:

- `db:deploy` on every release
- `db:seed` only when intended

## PostgreSQL backups

For a solo VM deployment, the practical baseline is:

- nightly `pg_dump` to a compressed file
- copy backups off the VM to object storage or another machine
- keep at least:
  - 7 daily backups
  - 4 weekly backups

Example backup command:

```bash
pg_dump "$DATABASE_URL" | gzip > backup-$(date +%F).sql.gz
```

If the app becomes important, add:

- WAL archiving or managed PostgreSQL backups
- regular restore testing into a staging database

## Operational notes

- keep `worker` private; do not expose port `4100` publicly
- keep `postgres` and `redis` private to the Docker network
- rotate `WORKER_INTERNAL_TOKEN` and `RENDER_ADMIN_TOKEN`
- monitor worker failure volume through `/internal/render/admin/state`
