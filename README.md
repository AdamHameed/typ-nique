# Typ-Nique

Typ-Nique is a competitive typesetting game for [Typst](https://typst.app/), inspired by TeXnique for LaTeX. Players are shown a rendered formula or snippet and must recreate it as quickly as possible from memory. The game is built around a real render-aware checker, not just string equality, so multiple valid Typst answers can still count when they produce the same output.

## Why This Project Is Interesting

Typ-Nique sits at an unusual intersection of frontend product design, compiler-style tooling, and backend systems work.

It combines:

- a polished timed web game
- guest and authenticated play
- content tooling for authoring challenge packs
- a render/check pipeline that compiles user Typst safely
- a tiered answer checker that can validate source-level and render-level equivalence
- leaderboard and daily challenge infrastructure

For anyone interested in developer tools, interactive learning products, or systems that evaluate user-generated code safely, this is a fun and practical project.

## Core Idea

Each round shows a rendered Typst target. The player types the Typst source that reproduces it. The game then decides whether the answer is correct using a tiered validation pipeline:

1. exact source match
2. normalized source match
3. accepted alternate source match
4. rendered SVG equivalence
5. structural comparison hooks for future improvement

The goal is to feel fair to players while still being strict enough to support score-based competition.

## Architecture Summary

The app is split into three application services plus data infrastructure:

- `web`: Next.js frontend for gameplay, auth, results, daily challenge, and leaderboards
- `api`: Fastify backend for game state, auth, sessions, scoring, challenge delivery, and leaderboard APIs
- `worker`: Typst render/check worker for preview rendering and submission verification
- `postgres`: primary relational datastore
- `redis`: queueing, caching, and coordination

### Request flow

- the browser talks to the `web` app
- the `web` app proxies API requests through same-origin `/api/v1/*`
- the `api` owns challenge selection, sessions, scoring, auth, and answer orchestration
- the `worker` safely compiles Typst and compares rendered output
- PostgreSQL stores challenge metadata, sessions, submissions, users, and leaderboard data
- Redis backs render queues and short-lived caching/rate-limit support

## Stack

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Fastify
- Prisma
- PostgreSQL
- Redis
- BullMQ
- Typst CLI
- Docker / Docker Compose

## Repository Layout

```text
apps/
  web/         Next.js frontend
  api/         Fastify API
  worker/      Typst rendering and checking service

packages/
  checker/     answer checker and SVG comparison logic
  types/       shared TypeScript contracts
  typst-utils/ Typst/SVG helpers
  ui/          shared UI primitives
  validation/  shared Zod schemas

prisma/
  schema.prisma
  prisma/seed.ts
  seeds/

data/
  challenges/  source-of-truth challenge pack JSON

infra/
  docker/
  compose/
  proxy/

docs/
  engineering-design.md
  advanced-answer-checker.md
  challenge-content-system.md
  typst-rendering-service.md
  docker-vm-deployment.md
  railway-deployment.md
```

## Features

- timed play mode
- daily challenge mode
- guest mode and account auth
- personal history and best scores
- global, daily, and weekly leaderboards
- live Typst preview during play
- content pipeline for challenge packs
- advanced answer checker with render-aware validation

## Local Setup

### Prerequisites

- Node.js 22+
- pnpm 9+
- Docker
- Typst CLI installed locally if you want real local rendering outside Docker

### 1. Copy environment variables

```bash
cp .env.example .env
```

For local development, keep:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
API_INTERNAL_URL=http://127.0.0.1:4000
WORKER_RENDER_URL=http://127.0.0.1:4100
```

That setup preserves browser cookies correctly while still letting server-side fetches use a stable loopback address.

### 2. Install dependencies

```bash
pnpm install
```

### 3. Start everything

The simplest path is:

```bash
pnpm dev
```

That script:

- starts PostgreSQL and Redis
- generates the Prisma client
- applies migrations
- seeds the database
- starts the web app, API, and worker

### 4. Open the app

- Web: `http://localhost:3000`
- API health: `http://localhost:4000/health`
- Worker health: `http://localhost:4100/health`

## Docker

### Local development with Docker Compose

Use the local development compose file:

```bash
docker compose -f infra/compose/docker-compose.yml up --build
```

Services:

- `web` on `localhost:3000`
- `api` on `localhost:4000`
- `worker` on `localhost:4100`
- `postgres` on `localhost:5432`
- `redis` on `localhost:6379`

The compose setup includes:

- bind mounts for development
- service health checks
- named volumes for data and dependency caches
- a tmpfs-backed `/tmp` for the render worker

### Production-oriented Dockerfiles

The repo includes separate production Dockerfiles:

- [web.Dockerfile](/Users/adam/Downloads/Projects/typ-nique/infra/docker/web.Dockerfile)
- [api.Dockerfile](/Users/adam/Downloads/Projects/typ-nique/infra/docker/api.Dockerfile)
- [worker.Dockerfile](/Users/adam/Downloads/Projects/typ-nique/infra/docker/worker.Dockerfile)

And separate development Dockerfiles:

- [web.dev.Dockerfile](/Users/adam/Downloads/Projects/typ-nique/infra/docker/web.dev.Dockerfile)
- [api.dev.Dockerfile](/Users/adam/Downloads/Projects/typ-nique/infra/docker/api.dev.Dockerfile)
- [worker.dev.Dockerfile](/Users/adam/Downloads/Projects/typ-nique/infra/docker/worker.dev.Dockerfile)

## Database Setup

The project uses PostgreSQL with Prisma.

### Generate the Prisma client

```bash
pnpm db:generate
```

### Apply development migrations

```bash
pnpm db:migrate
```

### Apply production migrations

```bash
pnpm db:deploy
```

### Seed the database

```bash
pnpm db:seed
```

The seed process loads categories, tags, challenge content, demo data, and sample leaderboard state.

## Challenge Content System

Challenge content lives in JSON packs under `data/challenges/`.

Each challenge supports:

- `id`
- `title`
- `slug`
- `difficulty`
- `category`
- `tags`
- `canonical_typst_source`
- `accepted_alternate_sources`
- `target_render_svg`
- `target_render_hash`
- `estimated_solve_time`
- `hint`
- `explanation`
- active/inactive status

### Content pipeline

The challenge system includes:

- validation of challenge JSON
- pre-rendering canonical SVGs
- canonical render-hash generation
- seeding into PostgreSQL

Useful commands:

```bash
pnpm content:validate
pnpm content:render
pnpm content:hash
pnpm content:seed
```

For more detail, see [challenge-content-system.md](/Users/adam/Downloads/Projects/typ-nique/docs/challenge-content-system.md).

## Advanced Checker

The answer checker is designed to avoid both overly strict and overly naive validation.

### Tiered validation pipeline

1. exact source match
2. normalized source match
3. accepted alternate source match
4. rendered output equivalence through SVG comparison
5. structural fallback heuristics

### What “rendered equivalence” means here

The checker does not rely on raw SVG string equality. It normalizes the rendered output before comparison, including:

- metadata stripping
- attribute-order normalization
- ID/reference stabilization
- numeric precision normalization
- structural signature comparison for practical MVP tolerance

This lets the game accept semantically equivalent Typst answers more fairly.

For more detail, see:

- [advanced-answer-checker.md](/Users/adam/Downloads/Projects/typ-nique/docs/advanced-answer-checker.md)
- [typst-rendering-service.md](/Users/adam/Downloads/Projects/typ-nique/docs/typst-rendering-service.md)

## Authentication

- guests can play immediately
- registered users keep persistent history and leaderboard identity
- auth uses HTTP-only cookie sessions
- guest progress can be promoted into an authenticated account

Auth endpoints include:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/session`
- `GET /api/v1/auth/history`

## Screenshots

Replace these placeholders with real screenshots once you have polished captures.

### Landing Page

`docs/screenshots/landing.png`

### Gameplay

`docs/screenshots/play.png`

### Results

`docs/screenshots/results.png`

### Leaderboard

`docs/screenshots/leaderboard.png`

### Daily Challenge

`docs/screenshots/daily.png`

## Roadmap

- stronger visual-diff fallback beyond SVG structural matching
- persistent leaderboard rollups and scheduled daily jobs
- richer multiplayer or async-versus modes
- challenge authoring/admin UI
- more curated challenge packs and difficulty tuning
- improved Typst sandboxing and resource isolation
- replayable daily history
- account settings and profile pages

## Additional Docs

- [engineering-design.md](/Users/adam/Downloads/Projects/typ-nique/docs/engineering-design.md)
- [docker-vm-deployment.md](/Users/adam/Downloads/Projects/typ-nique/docs/docker-vm-deployment.md)
- [railway-deployment.md](/Users/adam/Downloads/Projects/typ-nique/docs/railway-deployment.md)
- [testing-strategy.md](/Users/adam/Downloads/Projects/typ-nique/docs/testing-strategy.md)

## Status

This project is already a substantial working foundation, but it is still evolving. The current focus is on polishing the gameplay loop, hardening Typst execution, and tightening the production deployment path.
