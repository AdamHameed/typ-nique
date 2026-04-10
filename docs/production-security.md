# Production Security Hardening

This repository now includes a practical production hardening baseline for the web app, API, worker, and container images. The implementation is intentionally conservative: it tightens the most important defaults without introducing a large amount of operational overhead for a solo-maintained deployment.

## Environment handling

Service-specific example files:

- [apps/web/.env.example](/Users/adam/Downloads/Projects/typ-nique/apps/web/.env.example)
- [apps/api/.env.example](/Users/adam/Downloads/Projects/typ-nique/apps/api/.env.example)
- [apps/worker/.env.example](/Users/adam/Downloads/Projects/typ-nique/apps/worker/.env.example)
- [/.env.example](/Users/adam/Downloads/Projects/typ-nique/.env.example) for local full-stack development only

Current rules:

- No runtime `dotenv` dependency is used in production code paths.
- Each service validates its env at startup and fails fast with a structured `invalid-env` log when required values are missing.
- The web app separates public browser config from server-only config.
- Production requires explicit `ALLOWED_BROWSER_ORIGINS` on the API.
- Production requires `WORKER_INTERNAL_TOKEN` for API-to-worker calls.
- `ENABLE_RENDER_ADMIN=true` requires a separate `RENDER_ADMIN_TOKEN`.

Operational guidance:

- Keep `WORKER_INTERNAL_TOKEN` and `RENDER_ADMIN_TOKEN` different.
- Rotate secrets by updating the platform secret, deploying, then removing the old value from any remaining instances.
- Treat `NEXT_PUBLIC_*` values as public. Never put backend secrets in them.

## Implemented protections

### Web

- Added explicit security headers in [apps/web/next.config.mjs](/Users/adam/Downloads/Projects/typ-nique/apps/web/next.config.mjs).
- Disabled the `X-Powered-By` header.
- Added typed env validation and startup checks in [apps/web/src/lib/env.ts](/Users/adam/Downloads/Projects/typ-nique/apps/web/src/lib/env.ts) and [apps/web/src/instrumentation.ts](/Users/adam/Downloads/Projects/typ-nique/apps/web/src/instrumentation.ts).
- Hardened the runtime API proxy with upstream timeouts and a safe `503` fallback in [apps/web/src/app/api/v1/[...path]/route.ts](/Users/adam/Downloads/Projects/typ-nique/apps/web/src/app/api/v1/[...path]/route.ts).

How to demonstrate:

- `curl -I https://your-web-host` and verify `Referrer-Policy`, `X-Frame-Options`, and `Strict-Transport-Security` in production.
- Stop the API service temporarily and request `/api/v1/...` through the web app. The proxy should return a safe `503` JSON error instead of an unhandled exception.

### API

- Added fail-fast env validation in [apps/api/src/lib/env.ts](/Users/adam/Downloads/Projects/typ-nique/apps/api/src/lib/env.ts).
- Added centralized safe error handling, body-size enforcement, and request-id-aware responses in [apps/api/src/app.ts](/Users/adam/Downloads/Projects/typ-nique/apps/api/src/app.ts).
- Redacted cookies and internal auth headers from Fastify logs.
- Added explicit rate-limit headers and abuse logging for auth, leaderboard, preview, submission, and multiplayer HTTP mutations.
- Added auth route protection and safe login/register failure handling in [apps/api/src/routes/auth-routes.ts](/Users/adam/Downloads/Projects/typ-nique/apps/api/src/routes/auth-routes.ts).
- Tightened WebSocket handshake rules, payload limits, and message/connection rate limits in [apps/api/src/gateways/multiplayer-gateway.ts](/Users/adam/Downloads/Projects/typ-nique/apps/api/src/gateways/multiplayer-gateway.ts).

How to demonstrate:

- Invalid payload: `curl -i -X POST https://api-host/api/v1/submissions -H 'content-type: application/json' -d '{}'`
  Expected: `400` with a safe validation response.
- Oversized payload: send a body larger than `API_BODY_LIMIT_BYTES`.
  Expected: `413` and a `request-body-limit-exceeded` security log.
- Auth rate limit: repeat login failures until the limit is exceeded.
  Expected: `429` with `RateLimit-*` and `Retry-After` headers.
- CORS: send a request with `Origin: https://evil.example`.
  Expected: the origin is not allowed unless it is explicitly configured.
- WebSocket origin enforcement: connect with `wscat` or `websocat` using a disallowed `Origin` header.
  Expected: handshake rejection.

### Worker

- Added fail-fast env validation in [apps/worker/src/lib/env.ts](/Users/adam/Downloads/Projects/typ-nique/apps/worker/src/lib/env.ts).
- Added centralized safe error handling and request-size enforcement in [apps/worker/src/index.ts](/Users/adam/Downloads/Projects/typ-nique/apps/worker/src/index.ts).
- Added security logging for unauthorized preview/admin access in [apps/worker/src/routes/preview-routes.ts](/Users/adam/Downloads/Projects/typ-nique/apps/worker/src/routes/preview-routes.ts) and [apps/worker/src/routes/admin-routes.ts](/Users/adam/Downloads/Projects/typ-nique/apps/worker/src/routes/admin-routes.ts).
- Kept the render admin route disabled unless explicitly enabled.

How to demonstrate:

- Call `/internal/render/preview` without `x-worker-internal-token`.
  Expected: `401` plus a security log entry.
- Start the worker with `ENABLE_RENDER_ADMIN=true` and no `RENDER_ADMIN_TOKEN`.
  Expected: startup failure.

### Containers and CI

- Container images now run as the non-root `node` user in [infra/docker/api.Dockerfile](/Users/adam/Downloads/Projects/typ-nique/infra/docker/api.Dockerfile), [infra/docker/web.Dockerfile](/Users/adam/Downloads/Projects/typ-nique/infra/docker/web.Dockerfile), and [infra/docker/worker.Dockerfile](/Users/adam/Downloads/Projects/typ-nique/infra/docker/worker.Dockerfile).
- The web image disables Next telemetry in production.
- CI now includes `pnpm audit --prod --audit-level=high` and a Trivy filesystem scan in [ci.yml](/Users/adam/Downloads/Projects/typ-nique/.github/workflows/ci.yml).

How to demonstrate:

- Run `pnpm security:audit`.
- Check the CI `Security Audit` job output.
- After building images, inspect the configured user:
  `docker inspect --format '{{.Config.User}}' typ-nique-api:ci`
  `docker inspect --format '{{.Config.User}}' typ-nique-web:ci`
  `docker inspect --format '{{.Config.User}}' typ-nique-worker:ci`

## Remaining operational items

- Keep Railway services on private networking where possible, especially API-to-worker and API-to-Redis/Postgres paths.
- If the multiplayer gateway is exposed on a dedicated domain, keep `NEXT_PUBLIC_MULTIPLAYER_GATEWAY_URL` pointed there and include the web origin in `ALLOWED_BROWSER_ORIGINS`.
- Review security logs after launch for false positives and tune rate limits conservatively rather than disabling them.
