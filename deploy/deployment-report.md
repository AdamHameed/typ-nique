# Final Deployment Report

## Services created conceptually

- `web`: public Next.js frontend
- `api`: Fastify API, public when multiplayer WebSockets are enabled
- `worker`: private render/background service
- `postgres`: Railway-managed PostgreSQL
- `redis`: Railway-managed Redis

## Dockerfiles added or changed

- [web.Dockerfile](/Users/adam/Downloads/Projects/typ-nique/infra/docker/web.Dockerfile)
- [api.Dockerfile](/Users/adam/Downloads/Projects/typ-nique/infra/docker/api.Dockerfile)
- [worker.Dockerfile](/Users/adam/Downloads/Projects/typ-nique/infra/docker/worker.Dockerfile)
- [.dockerignore](/Users/adam/Downloads/Projects/typ-nique/.dockerignore)

## GHCR workflows added

- [images.yml](/Users/adam/Downloads/Projects/typ-nique/.github/workflows/images.yml)

This workflow:

- builds images for `web`, `api`, and `worker`
- pushes to GHCR on non-PR runs
- emits immutable image refs in the workflow summary
- uploads `railway-image-manifest`

## Tagging strategy used

Immutable production tag:

- `sha-<shortsha>`

Convenience tags:

- `main`
- `staging`
- `prod`
- `branch-<sanitized-branch-name>`
- `v<semver>`

Production deployments should use the immutable `sha-<shortsha>@digest` ref from the manifest artifact.

## Environment variables documented

Per-service env documentation exists in:

- [web.env.example](/Users/adam/Downloads/Projects/typ-nique/deploy/env/web.env.example)
- [api.env.example](/Users/adam/Downloads/Projects/typ-nique/deploy/env/api.env.example)
- [worker.env.example](/Users/adam/Downloads/Projects/typ-nique/deploy/env/worker.env.example)
- [railway-services.md](/Users/adam/Downloads/Projects/typ-nique/deploy/railway-services.md)

## Healthchecks added

- `web`: `/api/health`
- `api`: `/health`
- `worker`: `/health`

Readiness behavior:

- `api` waits for Postgres and Redis startup checks before reporting ready
- `worker` waits for Redis, Typst, and temp storage startup checks before reporting ready

## Railway config-as-code decision

Active Railway config-as-code files were intentionally not added.

Reason:

- this repo uses prebuilt images rather than Railway source builds
- Railway config files are still service-scoped, not a full multi-service project definition
- Railway config-as-code only covers build/deploy settings for a deployment, not the full dashboard state
- the important production state still lives in service image refs, domains, networking, and variables in the Railway dashboard

Adding partial `railway.toml` files here would create more confusion than value.

## Remaining manual Railway setup steps

- create Railway services for `web`, `api`, and `worker`
- provision Railway Postgres and Redis
- set service variables and shared secrets
- attach the immutable GHCR image refs from the manifest artifact
- attach public domains to `web` and, if needed, `api`
- configure healthcheck paths
- run `pnpm db:deploy`
- run `pnpm db:seed` only if intentionally needed

## First production deploy checklist

1. Merge to `prod` or create a release tag.
2. Wait for `Container Images` to publish GHCR images.
3. Download `railway-image-manifest`.
4. Create or update Railway services with the immutable refs.
5. Set required env vars for `web`, `api`, and `worker`.
6. Run `pnpm db:deploy`.
7. Verify `/api/health`, `/health`, and `/health`.
8. Smoke test login, preview rendering, and multiplayer if enabled.
