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
- `LOG_LEVEL` is validated for the API and worker so production verbosity is explicit instead of accidental.

Operational guidance:

- Keep `WORKER_INTERNAL_TOKEN` and `RENDER_ADMIN_TOKEN` different.
- Rotate secrets by updating the platform secret, deploying, then removing the old value from any remaining instances.
- Treat `NEXT_PUBLIC_*` values as public. Never put backend secrets in them.
- Keep `LOG_LEVEL=info` in production unless you are actively investigating an incident. Use `debug` only for short-lived troubleshooting.

## Logging model

The API and worker now emit structured JSON logs intended for aggregation in Railway, Docker, or any hosted log sink. Both services redact obvious secret-bearing fields such as cookies, authorization headers, passwords, secrets, and internal tokens before they leave the process.

Log levels:

- `error`: request failures, exhausted retries, denied startup, dependency outages, and shutdown failures.
- `warn`: suspicious activity, rejected auth, rate-limit hits, degraded dependencies, and retrying job failures.
- `info`: startup, readiness, successful dependency checks, and clean shutdown.
- `debug`: noisy success-path detail such as worker job start/completion. Safe for local development, usually off in production.

How to demonstrate:

- Start the worker with `LOG_LEVEL=info` and submit a successful render job.
  Expected: no per-job success spam in production logs.
- Start the worker with `LOG_LEVEL=debug`.
  Expected: `render-job-started` and `render-job-completed` entries appear.
- Send an auth request with a password and inspect logs.
  Expected: the password is not present in structured output.

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
- Added validated production log levels plus structured logger helpers in [apps/api/src/lib/logger.ts](/Users/adam/Downloads/Projects/typ-nique/apps/api/src/lib/logger.ts).
- Added centralized safe error handling, body-size enforcement, and request-id-aware responses in [apps/api/src/app.ts](/Users/adam/Downloads/Projects/typ-nique/apps/api/src/app.ts).
- Redacted cookies and internal auth headers from Fastify logs.
- Replaced console-based security logs with structured security events in [apps/api/src/lib/security-observability.ts](/Users/adam/Downloads/Projects/typ-nique/apps/api/src/lib/security-observability.ts).
- Added explicit startup, shutdown, and listen-failure logs in [apps/api/src/server.ts](/Users/adam/Downloads/Projects/typ-nique/apps/api/src/server.ts).
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
- Added validated production log levels plus structured worker logging in [apps/worker/src/lib/logger.ts](/Users/adam/Downloads/Projects/typ-nique/apps/worker/src/lib/logger.ts).
- Added centralized safe error handling, readiness reporting, startup/shutdown handling, and request-size enforcement in [apps/worker/src/index.ts](/Users/adam/Downloads/Projects/typ-nique/apps/worker/src/index.ts).
- Added startup dependency checks for Redis, Typst, and temp workspace creation in [apps/worker/src/lib/startup-checks.ts](/Users/adam/Downloads/Projects/typ-nique/apps/worker/src/lib/startup-checks.ts).
- Bound worker concurrency to validated render limits in [apps/worker/src/lib/queue.ts](/Users/adam/Downloads/Projects/typ-nique/apps/worker/src/lib/queue.ts).
- Ensured render temp roots are created safely before use in [apps/worker/src/renderer/temp-workspace.ts](/Users/adam/Downloads/Projects/typ-nique/apps/worker/src/renderer/temp-workspace.ts).
- Added security logging for unauthorized preview/admin access in [apps/worker/src/routes/preview-routes.ts](/Users/adam/Downloads/Projects/typ-nique/apps/worker/src/routes/preview-routes.ts) and [apps/worker/src/routes/admin-routes.ts](/Users/adam/Downloads/Projects/typ-nique/apps/worker/src/routes/admin-routes.ts).
- Kept the render admin route disabled unless explicitly enabled.

How to demonstrate:

- Call `/internal/render/preview` without `x-worker-internal-token`.
  Expected: `401` plus a security log entry.
- Start the worker with `ENABLE_RENDER_ADMIN=true` and no `RENDER_ADMIN_TOKEN`.
  Expected: startup failure.
- Start the worker with Redis unavailable or with `TYPST_BIN` pointing to a missing binary.
  Expected: startup fails fast with a structured `worker-startup-failed` log instead of waiting for the first user request.
- Send `SIGTERM` to the worker process while jobs are idle.
  Expected: `worker-shutdown-signal` then `worker-stopped`, and `/health` returns `503` during shutdown.

### Containers and CI

- Container images now run as the non-root `node` user in [infra/docker/api.Dockerfile](/Users/adam/Downloads/Projects/typ-nique/infra/docker/api.Dockerfile), [infra/docker/web.Dockerfile](/Users/adam/Downloads/Projects/typ-nique/infra/docker/web.Dockerfile), and [infra/docker/worker.Dockerfile](/Users/adam/Downloads/Projects/typ-nique/infra/docker/worker.Dockerfile).
- The web image disables Next telemetry in production.
- CI now includes dependency review, secret scanning, production dependency audit, Trivy filesystem scanning, build verification, main-branch integration tests, and main-branch container image scanning in [ci.yml](/Users/adam/Downloads/Projects/typ-nique/.github/workflows/ci.yml).

CI job intent:

- `Dependency Review`: blocks pull requests that introduce high-severity vulnerable dependency changes.
- `Secret Scan`: catches committed secrets and accidental credential leakage before merge.
- `Dependency Audit and Filesystem Scan`: catches vulnerable production dependencies plus common container/repo misconfigurations.
- `Lint, Typecheck, and Unit Tests`: catches correctness regressions and unsafe refactors quickly.
- `Build Verification`: proves the monorepo still compiles for production.
- `Integration Tests`: main-branch-only deeper API validation against live Postgres and Redis services.
- `Docker Build Verification`: proves pull requests still build deployable images.
- `Container Image Scan`: main-branch-only Trivy scan of the built API, web, and worker images.

How to demonstrate:

- Open a pull request that changes `package.json`.
  Expected: `Dependency Review` runs alongside the regular validation jobs.
- Add a fake high-entropy token to a throwaway branch.
  Expected: `Secret Scan` fails.
- Push to `main` or run the workflow manually.
  Expected: `Integration Tests` and `Container Image Scan` run in addition to the pull-request checks.
- Run `pnpm security:audit`.
- Check the CI workflow job output for `Dependency Audit and Filesystem Scan`.
- After building images, inspect the configured user:
  `docker inspect --format '{{.Config.User}}' typ-nique-api:ci`
  `docker inspect --format '{{.Config.User}}' typ-nique-web:ci`
  `docker inspect --format '{{.Config.User}}' typ-nique-worker:ci`

## Remaining operational items

- Keep Railway services on private networking where possible, especially API-to-worker and API-to-Redis/Postgres paths.
- If the multiplayer gateway is exposed on a dedicated domain, keep `NEXT_PUBLIC_MULTIPLAYER_GATEWAY_URL` pointed there and include the web origin in `ALLOWED_BROWSER_ORIGINS`.
- Review security logs after launch for false positives and tune rate limits conservatively rather than disabling them.
