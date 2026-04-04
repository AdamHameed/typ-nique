# Railway Deployment

Typ-Nique fits Railway best as five services:

- `web`: public Next.js service
- `api`: private Fastify service
- `worker`: private Typst render/check service
- `postgres`: Railway PostgreSQL
- `redis`: Railway Redis

## Service setup

Create three app services from the same repo.

### `web`

- Dockerfile: `infra/docker/web.Dockerfile`
- Public networking: enabled

Environment:

- `NODE_ENV=production`
- `API_INTERNAL_URL=http://<api-private-domain>`
- `NEXT_PUBLIC_API_URL=https://<your-web-domain>`

Notes:

- Browser requests should stay on the web origin.
- The web app rewrites `/api/v1/*` to `API_INTERNAL_URL`, which keeps auth and guest cookies same-origin.

### `api`

- Dockerfile: `infra/docker/api.Dockerfile`
- Public networking: usually disabled

Environment:

- `NODE_ENV=production`
- `DATABASE_URL=<Railway Postgres connection string>`
- `DIRECT_DATABASE_URL=<Railway Postgres connection string>`
- `REDIS_URL=<Railway Redis connection string>`
- `WORKER_RENDER_URL=http://<worker-private-domain>`
- `WORKER_INTERNAL_TOKEN=<long-random-secret>`
- `AUTH_COOKIE_SECURE=true`
- `AUTH_COOKIE_DOMAIN=<your-web-domain-without-protocol>` if you want explicit cookie scoping

### `worker`

- Dockerfile: `infra/docker/worker.Dockerfile`
- Public networking: disabled

Environment:

- `NODE_ENV=production`
- `REDIS_URL=<Railway Redis connection string>`
- `WORKER_INTERNAL_TOKEN=<same-secret-as-api>`
- `RENDER_ADMIN_TOKEN=<separate-admin-secret>`
- `TYPST_TIMEOUT_MS=4000`
- `TYPST_MAX_MEMORY_KB=524288`
- `TYPST_MAX_CONCURRENT_RENDERS=2`

## Migrations

Run migrations as a one-off command:

```bash
pnpm db:deploy
```

Seed only when intentionally bootstrapping or refreshing content:

```bash
pnpm db:seed
```

Do not use `prisma migrate dev` on Railway.

## Networking model

Recommended:

- web is the only public HTTP service
- api and worker use Railway private networking
- web proxies API calls through `/api/v1/*`
- api talks to worker over its private URL

This avoids cross-origin auth cookie issues and keeps the worker private.

## Health checks

Use:

- web: `/api/health`
- api: `/health`
- worker: `/health`

## Practical deployment order

1. Provision Railway Postgres and Redis.
2. Deploy `api` with DB and Redis env vars.
3. Run `pnpm db:deploy`.
4. Optionally run `pnpm db:seed`.
5. Deploy `worker`.
6. Deploy `web` with `API_INTERNAL_URL` pointing at the private API service.

## Notes

- Railway sets `PORT` automatically; the app now honors it for `api` and `worker`.
- `web` already works with Railway's dynamic port through the Next standalone server.
- Keep `worker` private. It should never be internet-exposed.
