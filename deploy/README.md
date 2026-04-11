# Deploy

This folder is documentation and reference material for production operations. It is not a production runtime input.

Railway config-as-code note:

- this repo intentionally does not commit active `railway.toml` or `railway.json` files for production services
- the production model here is prebuilt GHCR images plus Railway dashboard-managed services
- for a multi-service monorepo, Railway still treats each service separately, so a checked-in config file would only partially describe the real deployment
- keeping the deploy process in docs avoids a misleading "single source of truth" that does not actually include domains, image refs, shared variables, or service relationships

Use these docs for Railway image-based deploys:

- [GHCR images](/Users/adam/Downloads/Projects/typ-nique/deploy/ghcr-images.md)
- [Railway services](/Users/adam/Downloads/Projects/typ-nique/deploy/railway-services.md)
- [Release process](/Users/adam/Downloads/Projects/typ-nique/deploy/release-process.md)
- [Rollback](/Users/adam/Downloads/Projects/typ-nique/deploy/rollback.md)
- [Deployment report](/Users/adam/Downloads/Projects/typ-nique/deploy/deployment-report.md)

Environment examples live in:

- [web.env.example](/Users/adam/Downloads/Projects/typ-nique/deploy/env/web.env.example)
- [api.env.example](/Users/adam/Downloads/Projects/typ-nique/deploy/env/api.env.example)
- [worker.env.example](/Users/adam/Downloads/Projects/typ-nique/deploy/env/worker.env.example)

Key rules:

- production deploys use prebuilt GHCR images
- Railway services should be pinned to immutable `sha-<shortsha>@digest` refs
- Railway-managed Postgres and Redis should be used where possible
- local compose and setup containers stay development-only
- [docker-compose.prod.yml](/Users/adam/Downloads/Projects/typ-nique/infra/compose/docker-compose.prod.yml) is allowed only as a local production-like image test harness, not as the production orchestrator
