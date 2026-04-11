# GHCR Images

## Published images

- `ghcr.io/<owner>/<repo>-web`
- `ghcr.io/<owner>/<repo>-api`
- `ghcr.io/<owner>/<repo>-worker`

## Preferred Railway refs

Use the `reference` values from `railway-image-manifest`, for example:

- `ghcr.io/acme/typ-nique-web:sha-a1b2c3d4e5f6@sha256:...`
- `ghcr.io/acme/typ-nique-api:sha-a1b2c3d4e5f6@sha256:...`
- `ghcr.io/acme/typ-nique-worker:sha-a1b2c3d4e5f6@sha256:...`

Do not deploy production from moving tags like `main`.

## Workflow behavior

- pull requests: images build but do not push
- branch pushes: images push with immutable and branch convenience tags
- release tags: images push with immutable and semver tags
- workflow summary: shows final refs directly in GitHub Actions

## Registry access

If Railway needs manual GHCR credentials:

- username: a GitHub user or bot with package read access
- password: a token with `read:packages`
