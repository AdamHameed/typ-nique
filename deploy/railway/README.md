# Railway Deployment Artifacts

This folder is documentation/reference only. It is not a production runtime input.

Expected CI artifact:

- `image-manifest.json`

The GitHub Actions `Container Images` workflow writes that file and uploads it as the `railway-image-manifest` artifact. It contains:

- git SHA
- immutable `sha-<shortsha>` tag
- generated timestamp
- published convenience tags for each service
- pushed digest for each service
- full `tag@digest` reference for Railway

Use the `reference` value for each service when updating Railway:

- `web`
- `api`
- `worker`

Do not deploy Railway from a moving tag like `main` or `staging`. Use the immutable `reference` value from the artifact.

Do not hand-edit this folder as part of normal deployments. Treat the workflow artifact as the source of truth for each release.
