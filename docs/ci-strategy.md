# CI Strategy

## Workflows

### Required workflow

`/.github/workflows/ci.yml`

This workflow runs on pushes to `main`, `develop`, and `release/**`, plus all pull requests and manual dispatches.

It verifies:

- linting
- type checking
- unit tests
- integration tests
- build verification
- Docker build verification

The jobs are intentionally separated so failures point to one concern at a time.

### Optional workflow

`/.github/workflows/e2e.yml`

This workflow runs:

- manually through `workflow_dispatch`
- automatically on pull requests labeled `ci:e2e`

That keeps E2E coverage available without making every PR wait on browser tests.

## Commands

Use these locally and in CI:

- `pnpm ci:lint`
- `pnpm ci:typecheck`
- `pnpm ci:test:unit`
- `pnpm ci:test:integration`
- `pnpm ci:build`
- `pnpm ci:docker`
- `pnpm ci:verify`
- `pnpm test:e2e`

Supporting scripts:

- `pnpm test:checker`
- `pnpm test:api:unit`
- `pnpm test:api:integration`
- `pnpm test:web`
- `pnpm docker:build:api`
- `pnpm docker:build:web`
- `pnpm docker:build:worker`

## Caching strategy

### pnpm

`actions/setup-node` handles pnpm store caching keyed from the lockfile.

### Turbo

The required workflow restores `.turbo` caches keyed by lockfile, package manifests, and core config files. This speeds repeated lint, typecheck, and build jobs without relying on `node_modules` caching.

### Docker

Docker image verification uses `docker/build-push-action` with GitHub Actions cache storage:

- `type=gha,scope=api`
- `type=gha,scope=web`
- `type=gha,scope=worker`

That keeps layer reuse scoped and avoids cross-image cache pollution.

### Playwright

The optional E2E workflow caches `~/.cache/ms-playwright` keyed from the lockfile.

## Failure behavior

- `concurrency.cancel-in-progress` is enabled so stale branch builds are cancelled when a newer commit arrives.
- Required jobs fail independently and visibly; one failure does not hide the others.
- Docker verification is required but does not push images.
- Optional E2E is not part of the required workflow, so it does not block normal PR iteration unless you explicitly request it with the `ci:e2e` label.

## Branch and PR recommendations

- Protect `main` with required checks from `ci.yml`.
- Require pull requests for `main`; avoid direct pushes except for admins in emergencies.
- Require branches to be up to date before merge if your team often rebases or lands fast-moving infra changes.
- Start with squash merges unless preserving individual commits matters for your release process.
- Treat `ci:e2e` as an opt-in signal for risky UI, routing, auth, or gameplay changes.

Recommended required checks:

- `CI / Lint`
- `CI / Typecheck`
- `CI / Unit Tests`
- `CI / Integration Tests`
- `CI / Build Verification`
- `CI / Docker Build Verification`

## Environment variables in CI

The required workflow uses non-secret placeholder values for build and test safety:

- URLs point to localhost
- auth and worker tokens are dummy values
- database and redis URLs are inert unless a job actually starts those services

Guidance:

- Keep non-sensitive defaults in workflow `env` when they are needed only for parsing or build-time wiring.
- Keep secrets in GitHub Actions secrets, not in workflow files.
- Only expose production-like secrets to jobs that truly need them.
- For E2E, prefer stubbed networking and temporary CI-only values unless the workflow is exercising a real deployed environment.
