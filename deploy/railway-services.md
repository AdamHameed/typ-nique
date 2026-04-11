# Railway Services

## Config-as-code recommendation

Do not add active Railway config-as-code files for this production setup.

Why:

- this repository deploys prebuilt images from GHCR instead of building from source on Railway
- Railway config files are still service-scoped rather than a full multi-service project definition
- Railway config-as-code only covers build/deploy settings for a single deployment, not the full dashboard state
- public domains, private networking, image refs, shared variables, and managed data services still need dashboard configuration
- adding partial `railway.toml` files here would look authoritative while leaving the most important production settings elsewhere

If you want config-as-code later for a specific source-built service, add a service-local file deliberately and document its scope clearly. In a monorepo, Railway resolves config files per service and expects the config path explicitly when it is not at the service package root. For this repo, the higher-value approach is keeping deploy steps and env examples explicit.

## Service map

- `web`: public Next.js service
- `api`: public Fastify service when multiplayer WebSockets are enabled
- `worker`: private background/render service
- `postgres`: Railway-managed PostgreSQL
- `redis`: Railway-managed Redis

## Public vs private

- `web` should be public.
- `api` should be public if browsers need multiplayer WebSockets.
- `worker` should stay private.
- `postgres` and `redis` stay private.

If multiplayer is not enabled in an environment, the API can stay private there.

## Internal networking

- `web -> api`: Railway private networking through `API_INTERNAL_URL`
- `api -> worker`: Railway private networking through `WORKER_RENDER_URL`
- `api -> postgres`: Railway-managed private connection string
- `api -> redis`: Railway-managed private connection string
- `worker -> redis`: Railway-managed private connection string

Browser traffic:

- normal REST calls should stay same-origin through the web proxy
- multiplayer WebSockets should use `NEXT_PUBLIC_MULTIPLAYER_GATEWAY_URL`

## Healthchecks

Set these Railway healthcheck paths:

- `web`: `/api/health`
- `api`: `/health`
- `worker`: `/health`

Health behavior:

- `web` reports process health
- `api` reports process health plus Postgres/Redis readiness
- `worker` reports process health plus Redis/Typst/temp-storage readiness

Readiness behavior:

- `api` starts listening only after startup dependency checks for Postgres and Redis succeed
- `worker` starts listening only after startup dependency checks for Redis, Typst, and temp storage succeed
- both services retry dependency checks with bounded backoff so Railway deploys do not depend on compose-style startup ordering

## Service variables

### `web`

Required:

- `NODE_ENV=production`
- `API_INTERNAL_URL=http://<api-private-host>`

Recommended:

- `NEXT_PUBLIC_MULTIPLAYER_GATEWAY_URL=https://<api-public-domain>`

Optional:

- `NEXT_PUBLIC_API_URL=` if the browser should call a public API origin directly
- `NEXT_PUBLIC_ENABLE_MULTIPLAYER_DIAGNOSTICS=false`

### `api`

Required:

- `NODE_ENV=production`
- `LOG_LEVEL=info`
- `DATABASE_URL=<Railway Postgres URL>`
- `DIRECT_DATABASE_URL=<Railway Postgres URL>`
- `REDIS_URL=<Railway Redis URL>`
- `WORKER_RENDER_URL=http://<worker-private-host>`
- `WORKER_INTERNAL_TOKEN=<shared-secret-with-worker>`
- `ALLOWED_BROWSER_ORIGINS=https://<web-public-domain>`
- `AUTH_COOKIE_SECURE=true`

Recommended:

- `API_STARTUP_CHECK_TIMEOUT_MS=5000`
- `API_STARTUP_MAX_ATTEMPTS=12`
- `API_STARTUP_RETRY_DELAY_MS=2000`

Migration note:

- run `pnpm db:deploy` as a one-off operation using the same API image that is being released
- do not run migrations inside the normal API container startup path

### `worker`

Required:

- `NODE_ENV=production`
- `LOG_LEVEL=info`
- `REDIS_URL=<Railway Redis URL>`
- `WORKER_INTERNAL_TOKEN=<shared-secret-with-api>`

Recommended:

- `WORKER_STARTUP_CHECK_TIMEOUT_MS=5000`
- `WORKER_STARTUP_MAX_ATTEMPTS=12`
- `WORKER_STARTUP_RETRY_DELAY_MS=2000`
- `ENABLE_RENDER_ADMIN=false`

## Manual Railway dashboard configuration

These still need to be configured manually in Railway:

- create the `web`, `api`, and `worker` services
- attach GHCR images to each service using immutable refs from the manifest artifact
- provision Railway Postgres and Redis
- attach public domains to `web` and, if multiplayer is enabled, `api`
- mark `worker` as private
- set shared and per-service environment variables
- set Railway healthcheck paths
- configure any branch protection or human approval steps around production deploys
