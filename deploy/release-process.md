# Release Process

## Recommended migration strategy

Use committed Prisma migrations plus `prisma migrate deploy` through `pnpm db:deploy`.

Principles:

- production migrations must come from versioned migration files in the repository
- production startup must not depend on a setup/bootstrap container
- migrations should run as an explicit operational step, not as a side effect of container boot
- schema changes should be backward-compatible with the previous release whenever practical

For higher-risk schema changes, prefer an expand-contract rollout:

1. ship additive schema changes first
2. deploy application code that can work with both old and new shapes
3. remove old columns or assumptions only in a later release

This keeps image deploys reproducible and makes rollback much safer.

## Image-based deployment flow

1. Merge the production change to `prod`, or push a release tag like `v1.2.3`.
2. Wait for the `Container Images` workflow to finish.
3. Download the `railway-image-manifest` artifact.
4. Copy the immutable `reference` values for `web`, `api`, and `worker`.
5. Update Railway so the `api` service points at the new API image ref, but do not yet route user traffic if you use a controlled rollout.
6. Run `pnpm db:deploy` as a one-off command using the same API image and the production database connection.
7. Update `worker` and `web` to the new immutable image refs.
8. Run `pnpm db:seed` only if you intentionally need seed content for bootstrap or content updates.
9. Confirm Railway healthchecks pass.
10. Run smoke checks against the live environment.

Where migrations should run:

- against the production database
- from a one-off Railway shell/job using the API image, or from a trusted operator shell with the same image version and env

Why this is the recommendation:

- the migration command uses the same code and Prisma version as the release artifact
- service startup stays fast and deterministic
- Railway deploy success is not coupled to hidden migration side effects

Seeding strategy:

- do not seed automatically on every release
- treat seeding as a manual, intentional operation
- use `pnpm db:seed` only for initial bootstrap or specific curated data updates
- keep seed operations idempotent where practical

## Tagging conventions

Each publish creates:

- immutable tag: `sha-<shortsha>`

Optional convenience tags:

- `main`
- `staging`
- `prod`
- `branch-<sanitized-branch-name>`
- `v<semver>`

Production deploys should always use the immutable `sha-<shortsha>@digest` ref from the artifact.

## Release verification

Check:

- `web` returns `200` on `/api/health`
- `api` returns `200` on `/health`
- `worker` returns `200` on `/health`
- login/signup work from the public web domain
- preview render works
- multiplayer WebSockets connect if enabled

## Rollback strategy

Application rollback:

1. open a previous successful `Container Images` run
2. download the older `railway-image-manifest`
3. repoint Railway services to the earlier immutable refs
4. redeploy the affected services

Database rollback:

- do not assume Prisma migrations can be safely reversed automatically in production
- prefer backward-compatible migrations so application rollback does not require immediate schema rollback
- if a migration is not backward-compatible, document the manual recovery plan in the pull request or release notes before deploying

## How Codex should document releases

When updating this file or related deploy docs, keep the process:

- image-based, not compose-based
- explicit about one-off migrations
- explicit about seeding being manual
- centered on immutable image refs from the manifest artifact
- short enough that a solo operator can follow it during a real deploy
