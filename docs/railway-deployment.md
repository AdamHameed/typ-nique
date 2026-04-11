# Railway Deployment

Typ-Nique is wired for Railway as a prebuilt-image deployment, not a compose-based runtime. CI builds Docker images, pushes them to GHCR, and uploads a `railway-image-manifest` artifact with the exact immutable image references to deploy.

## Railway readiness audit

Current production posture:

- `web`, `api`, and `worker` bind to `0.0.0.0`.
- `web`, `api`, and `worker` honor Railway's injected `PORT`.
- Runtime images are multi-stage and production-oriented.
- `api`, `web`, and `worker` expose explicit healthcheck paths.
- Worker startup tolerates dependency timing without compose-style `depends_on`.
- Local compose remains development-only and is not part of the production path.

Key production decisions in this setup:

- Railway runs one service per image: `web`, `api`, and `worker`.
- Postgres and Redis should be Railway-managed where possible.
- Railway private networking is used for all server-to-server traffic.
- Production deployments are pinned to immutable image refs, not moving tags.
- The local compose `setup` container stays development-only and is not used in production.
- A separate [docker-compose.prod.yml](/Users/adam/Downloads/Projects/typ-nique/infra/compose/docker-compose.prod.yml) exists only for local image-based smoke testing of the same runtime images.

## Service architecture

Services:

- `web`: public Next.js service
- `api`: public Fastify service for browser WebSockets and optional direct API access
- `worker`: private background/render service
- `postgres`: Railway PostgreSQL
- `redis`: Railway Redis

Public vs private:

- `web` should be public.
- `api` should be public when multiplayer/WebSockets are enabled.
- `worker` should stay private.
- `postgres` and `redis` stay private Railway-managed services.

Why the API is public:

- normal browser REST traffic can stay same-origin through the `web` service proxy
- browser WebSockets cannot use Railway private hostnames
- multiplayer needs a public `wss://` URL that points to the API gateway

If multiplayer is disabled in a given environment, the API can stay private there.

## URL and environment strategy

Local development:

- browser REST traffic uses the web app and its `/api/v1/*` proxy
- web server-side traffic uses `API_INTERNAL_URL=http://127.0.0.1:4000`
- browser WebSockets use `NEXT_PUBLIC_API_URL=http://localhost:4000` by default

Production on Railway:

- browser REST traffic should continue using the same-origin `web` proxy where possible
- web server-side traffic should use `API_INTERNAL_URL=http://<api-private-host>`
- browser WebSockets should use `NEXT_PUBLIC_MULTIPLAYER_GATEWAY_URL=https://<api-public-domain>`
- API-to-worker traffic should use `WORKER_RENDER_URL=http://<worker-private-host>`
- API and worker should use Railway-managed Postgres/Redis connection strings

No production localhost assumptions should remain in Railway variables.

## Image tagging strategy

Immutable production tag:

- `sha-<shortsha>`

Convenience tags:

- `main` for the `main` branch
- `staging` for the `staging` branch
- `prod` for the `prod` or `production` branch
- `branch-<sanitized-branch-name>` for other branch pushes
- `v<semver>` for release tags like `v1.2.3`

Branch-to-tag mapping:

- `main` push: `sha-<shortsha>`, `branch-main`, `main`
- `staging` push: `sha-<shortsha>`, `branch-staging`, `staging`
- `feature/matchmaking` push: `sha-<shortsha>`, `branch-feature-matchmaking`
- `v1.2.3` tag push: `sha-<shortsha>`, `v1.2.3`

Production should always deploy the immutable `sha-<shortsha>@digest` ref from the workflow artifact. Moving tags are for convenience only.

Examples of final image refs:

- `ghcr.io/acme/typ-nique-web:sha-a1b2c3d4e5f6@sha256:...`
- `ghcr.io/acme/typ-nique-api:sha-a1b2c3d4e5f6@sha256:...`
- `ghcr.io/acme/typ-nique-worker:sha-a1b2c3d4e5f6@sha256:...`

Rollback strategy:

1. Open a previous successful `Container Images` workflow run.
2. Download the older `railway-image-manifest` artifact.
3. Copy the earlier immutable `reference` values back into the Railway services.
4. Redeploy the affected service or services.

Rollback does not require rebuilding images or moving tags.

## CI workflow integration notes

`Container Images` behavior:

- Pull requests: build all images, do not push
- Branch pushes: push `sha-<shortsha>` and branch convenience tags
- Release tag pushes: push `sha-<shortsha>` and matching `v<semver>` tags
- Manual runs: push the same tag set for the selected ref

Workflow outputs:

- GitHub Actions summary shows final image refs for `web`, `api`, and `worker`
- `railway-image-manifest` artifact records the immutable refs and published tags

Least privilege:

- PR image builds run with read-only permissions
- publish runs get `packages: write` so they can push to GHCR

## Manual Railway dashboard configuration

### 1. Create backing services

Provision:

- Railway PostgreSQL
- Railway Redis

Use Railway-managed connection strings where possible instead of self-managed infrastructure.

### 2. Create the app services

Create three Railway services from image, not from source:

- `web`
- `api`
- `worker`

For each service:

- Deployment source: `Container Registry`
- Registry: `GHCR`
- Image: use the matching `reference` from the `railway-image-manifest` artifact
- Start command: leave empty unless Railway explicitly requires an override
- Build command: none

### 3. Configure networking

Recommended networking model:

- `web`: public networking enabled
- `api`: public networking enabled if multiplayer/WebSockets are enabled
- `worker`: public networking disabled

Internal service-to-service traffic:

- `web -> api` over Railway private networking
- `api -> worker` over Railway private networking
- `api -> postgres` over Railway private networking
- `api -> redis` over Railway private networking
- `worker -> redis` over Railway private networking

### 4. Configure healthchecks

Set these in Railway:

- `web`: `/api/health`
- `api`: `/health`
- `worker`: `/health`

### 5. Set service variables

Do not set `PORT` manually. Railway injects it.

#### `web`

Required:

- `NODE_ENV=production`
- `API_INTERNAL_URL=http://<api-private-host>`

Recommended:

- `NEXT_PUBLIC_MULTIPLAYER_GATEWAY_URL=https://<api-public-domain>`

Optional:

- `NEXT_PUBLIC_API_URL=` only if browser traffic should target a public API origin instead of the same-origin web proxy
- `NEXT_PUBLIC_ENABLE_MULTIPLAYER_DIAGNOSTICS=false`

Notes:

- browser REST traffic should use the same-origin `/api/v1/*` proxy by default
- `API_INTERNAL_URL` is server-only and should point at the Railway private hostname
- `NEXT_PUBLIC_MULTIPLAYER_GATEWAY_URL` is browser-visible and should point at the public API hostname when multiplayer is enabled

#### `api`

Required:

- `NODE_ENV=production`
- `LOG_LEVEL=info`
- `DATABASE_URL=<Railway Postgres connection string>`
- `DIRECT_DATABASE_URL=<Railway Postgres connection string>`
- `REDIS_URL=<Railway Redis connection string>`
- `WORKER_RENDER_URL=http://<worker-private-host>`
- `WORKER_INTERNAL_TOKEN=<long-random-secret>`
- `ALLOWED_BROWSER_ORIGINS=https://<web-public-domain>`
- `AUTH_COOKIE_SECURE=true`

Common optional values:

- `AUTH_COOKIE_DOMAIN=<public-domain-without-protocol>`
- `ENABLE_MULTIPLAYER_DIAGNOSTICS=false`
- `AUTH_SESSION_TTL_DAYS=30`

Notes:

- `WORKER_RENDER_URL` should always use the private Railway hostname
- if multiplayer is enabled, attach a public Railway domain to the API service for browser WebSockets

#### `worker`

Required:

- `NODE_ENV=production`
- `LOG_LEVEL=info`
- `REDIS_URL=<Railway Redis connection string>`
- `WORKER_INTERNAL_TOKEN=<same-value-as-api>`

Recommended:

- `ENABLE_RENDER_ADMIN=false`
- `TYPST_TIMEOUT_MS=4000`
- `TYPST_MAX_MEMORY_KB=524288`
- `TYPST_MAX_CONCURRENT_RENDERS=2`

Only if you intentionally expose internal admin behavior:

- `RENDER_ADMIN_TOKEN=<separate-long-random-secret>`
- `ENABLE_RENDER_ADMIN=true`

### 6. Configure GHCR access

If Railway needs explicit registry credentials for GHCR:

- username: a GitHub user or bot with package read access
- password: a GitHub token with `read:packages`

If Railway can inherit access from the linked GitHub integration in your environment, use that instead.

### 7. Run migrations and optional seeding

After `api` can reach Postgres, run a one-off command against the API image or a temporary admin shell:

```bash
pnpm db:deploy
```

Seed only when intentionally bootstrapping content:

```bash
pnpm db:seed
```

Do not use `prisma migrate dev` on Railway.

## Practical deployment order

1. Merge to `prod` or push a release tag.
2. Wait for the `Container Images` workflow to finish.
3. Download the `railway-image-manifest` artifact.
4. Provision Railway Postgres and Redis.
5. Create or update `api` with the manifest image ref and variables.
6. Run `pnpm db:deploy`.
7. Optionally run `pnpm db:seed`.
8. Create or update `worker` with the manifest image ref and variables.
9. Create or update `web` with the manifest image ref and variables.
10. Attach public domains to `web` and, if multiplayer is enabled, `api`.
11. Verify all healthchecks pass.

## Verification after deployment

Check:

- `web` responds on `/api/health`
- `api` responds on `/health`
- `worker` responds on `/health`
- signup/login work through the `web` origin
- preview render works
- multiplayer WebSockets connect through the API public domain
- worker logs show successful startup checks
- API logs show startup without listen or env errors

## Developer notes

- Use the local compose `setup` container only for local development.
- Do not treat compose as the production orchestrator.
- Do not deploy Railway from a moving tag like `main` or `staging`.
- Always prefer the immutable `reference` value from the manifest artifact.
