# Rollback

## Fast rollback procedure

1. Open a previous successful `Container Images` workflow run.
2. Download the older `railway-image-manifest` artifact.
3. Copy the earlier immutable `reference` values for the affected services.
4. Update Railway to those previous refs.
5. Redeploy the services.

## Why this is safe

- the image refs are immutable
- rollback does not depend on rebuilding images
- rollback does not depend on moving tags like `main`

## Practical notes

- roll back `web`, `api`, and `worker` together if the release changed shared contracts
- if the issue is isolated to one service, rolling back only that service is usually fine
- if the schema changed incompatibly, evaluate whether the database migration also needs manual intervention
