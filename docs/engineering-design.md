# Typ-Nique Engineering Design

## 1. Product Overview

Typ-Nique is a competitive web app where players see a rendered Typst expression, formula, or short snippet and must type the Typst source that reproduces it before time runs out.

The core experience should feel:

- fast
- skill-based
- polished
- fair
- replayable

The differentiator is the answer checker. Instead of requiring a single literal source string, the system validates submissions through multiple levels:

1. exact source match
2. normalized source match
3. rendered SVG equivalence
4. accepted alternate answers

This preserves the game feel of a typing challenge while respecting Typst’s expressive flexibility.

### Product goals

- Reward actual Typst fluency, not only memorization of one formatting style.
- Make rounds feel instant and competitive.
- Support trustworthy scoring and anti-cheat constraints.
- Be architecturally clean enough to showcase strong systems design on a resume.
- Stay realistic for a solo developer to ship and maintain.

### Non-goals for MVP

- full document editing
- arbitrary long-form Typst projects
- real-money competition
- unbounded user-generated content without moderation
- perfect semantic equivalence for all Typst constructs

## 2. MVP Scope

The MVP should focus on a tight single-player loop with a strong checker and production-style infrastructure.

### Core gameplay

- User signs in or plays as guest.
- User starts a timed run.
- Each round shows one pre-generated Typst render.
- User types source into an editor with syntax highlighting.
- Submission is checked with the tiered strategy.
- Score is awarded based on correctness, speed, streak, and difficulty.
- Results screen shows round breakdown and final score.

### Content scope

- 100 to 300 curated prompts
- prompt categories:
- inline math
- display math
- text styling
- small layout fragments
- moderate syntax variation cases

### MVP product surfaces

- landing page
- auth
- game screen
- results screen
- profile with personal bests
- admin/content ingestion tools for prompts

### MVP constraints

- only curated prompt library
- single-player only
- no live PvP
- no freeform prompt creation by end users
- no native mobile app

## 3. Stretch Goals

### Near-term

- daily challenge
- global and friends leaderboards
- rank tiers and seasons
- replay viewer with accepted-vs-submitted diff
- prompt packs by topic or difficulty
- ghost mode showing pace against a previous run

### Mid-term

- asynchronous head-to-head matches
- spectating and shareable challenge links
- community prompt submissions with moderation queue
- anti-cheat review pipeline
- richer normalized matching with AST-aware canonicalization

### Long-term

- real-time multiplayer race rooms
- creator economy around challenge packs
- educational mode with hints and breakdowns
- team competitions or classroom mode

## 4. Recommended Tech Stack

The best balance of resume value, code quality, and solo scope is a TypeScript-first monorepo.

### Frontend

- Next.js with App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui or a light custom component system
- Monaco Editor for Typst input
- TanStack Query for server state
- Zustand for small client-side game state

### Backend

- NestJS or Fastify with TypeScript
- Prefer NestJS if resume signaling and explicit architecture matter more.
- Prefer Fastify if speed and lower ceremony matter more.
- Recommendation: NestJS for this project

### Data and jobs

- PostgreSQL
- Prisma ORM
- Redis for rate limiting, caching, and job coordination
- BullMQ for async render/check jobs

### Typst rendering service

- Separate containerized service
- Rust or Go wrapper around Typst CLI if building a custom daemon later
- MVP recommendation: isolated service using Typst CLI plus a thin TypeScript worker

### Infra

- Docker and Docker Compose for local dev
- Nginx or Caddy as reverse proxy in production
- S3-compatible storage for SVG artifacts
- OpenTelemetry or structured logging with Pino

### Why this stack

- Strong industry signaling
- Clean typed contracts across frontend and backend
- Easy Dockerized local development
- Good support for queues and background processing
- Realistic for one developer

## 5. High-Level Architecture

The system should be split into four main areas.

### 1. Web app

- Serves the UI
- Handles auth session
- Calls backend APIs
- Renders gameplay and result views

### 2. Core API

- Owns users, prompts, sessions, scoring, leaderboards
- Stores canonical prompt metadata
- Orchestrates answer checking
- Enqueues expensive compile/compare tasks

### 3. Typst render/check worker

- Receives compile requests from queue
- Runs Typst in a hardened sandbox
- Produces SVG output
- Normalizes SVG and returns render fingerprints
- Reports structured compile errors

### 4. Data layer

- PostgreSQL for core relational data
- Redis for ephemeral state, queues, and hot caches
- Object storage for prompt and submission artifacts

### Request flow

1. Admin seeds prompt with canonical Typst source.
2. Prompt pipeline pre-renders canonical source to SVG and stores:
3. canonical source
4. normalized canonical source
5. canonical SVG
6. canonical render fingerprint
7. optional alternate answers
8. Player starts run and receives prompt metadata plus target SVG URL.
9. Player submits Typst source.
10. API performs cheap checks first.
11. If needed, API dispatches render-equivalence job.
12. Worker compiles submission in sandbox and computes normalized render fingerprint.
13. API records verdict, score delta, latency, and audit metadata.

### Architectural principle

Anything involving user-submitted Typst compilation should happen outside the main web process.

## 6. Database Schema Overview

Use PostgreSQL with strongly constrained tables and append-only event-style records where useful.

### Core tables

#### `users`

- `id`
- `username`
- `email`
- `password_hash` or external auth id
- `created_at`
- `updated_at`
- `skill_rating`
- `is_admin`

#### `prompts`

- `id`
- `slug`
- `title`
- `category`
- `difficulty`
- `canonical_source`
- `normalized_canonical_source`
- `canonical_svg_storage_key`
- `canonical_render_fingerprint`
- `accepted_alternates_json`
- `status` (`draft`, `active`, `retired`)
- `created_by`
- `created_at`
- `updated_at`

#### `prompt_tags`

- `id`
- `prompt_id`
- `tag`

#### `runs`

- `id`
- `user_id` nullable for guests
- `mode` (`practice`, `ranked`, `daily`)
- `started_at`
- `ended_at`
- `time_limit_ms`
- `score`
- `accuracy`
- `prompts_attempted`
- `prompts_correct`
- `seed`

#### `run_rounds`

- `id`
- `run_id`
- `prompt_id`
- `round_index`
- `presented_at`
- `submitted_at`
- `time_taken_ms`
- `raw_submission`
- `normalized_submission`
- `verdict` (`correct`, `incorrect`, `compile_error`, `timeout`)
- `match_tier` (`exact`, `normalized`, `rendered`, `alternate`, `none`)
- `score_awarded`
- `render_job_id` nullable
- `submission_svg_storage_key` nullable
- `submission_render_fingerprint` nullable

#### `leaderboard_entries`

- `id`
- `scope` (`global`, `daily`, `weekly`, `friends`)
- `scope_key`
- `user_id`
- `run_id`
- `score`
- `ranked_at`

#### `daily_challenges`

- `id`
- `challenge_date`
- `prompt_set_version`
- `seed`
- `created_at`

#### `render_jobs`

- `id`
- `job_type` (`canonical_generate`, `submission_check`)
- `status`
- `prompt_id` nullable
- `run_round_id` nullable
- `input_source_hash`
- `started_at`
- `finished_at`
- `error_code` nullable
- `error_message` nullable
- `sandbox_metadata_json`

### Recommended indexes

- `prompts(status, difficulty, category)`
- `runs(user_id, started_at desc)`
- `run_rounds(run_id, round_index)`
- `leaderboard_entries(scope, scope_key, score desc)`
- unique index on `daily_challenges(challenge_date)`
- index on `render_jobs(status, created_at)`

## 7. API Design

Use versioned JSON APIs. Keep the compile/check endpoint behind authenticated rate limits even for guests.

### Auth

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

### Prompts and gameplay

- `POST /api/v1/runs`
- Creates a run and returns first prompt payload.

- `GET /api/v1/runs/:runId/current`
- Returns current round state and target render.

- `POST /api/v1/runs/:runId/submit`
- Body:
- `promptId`
- `submissionSource`
- `clientTimestamp`

- Response:
- `verdict`
- `matchTier`
- `scoreAwarded`
- `normalizedDiff` optional
- `compileError` optional
- `nextPrompt` optional

- `POST /api/v1/runs/:runId/finish`
- Finalizes score.

### Leaderboards and profiles

- `GET /api/v1/leaderboards?scope=global`
- `GET /api/v1/leaderboards?scope=daily&date=YYYY-MM-DD`
- `GET /api/v1/users/:username`
- `GET /api/v1/users/:username/runs`

### Admin/content endpoints

- `POST /api/v1/admin/prompts`
- `POST /api/v1/admin/prompts/:id/render`
- `PATCH /api/v1/admin/prompts/:id`
- `POST /api/v1/admin/prompts/:id/activate`

### Internal worker endpoints

These can be queue-driven instead of HTTP in MVP.

- `renderCanonical(promptId)`
- `checkSubmission(runRoundId)`

## 8. Frontend Structure

The frontend should feel polished, fast, and competition-oriented without overbuilding.

### Route structure

- `/`
- `/play`
- `/results/[runId]`
- `/leaderboards`
- `/daily`
- `/u/[username]`
- `/admin/prompts`

### App sections

#### Marketing shell

- hero
- gameplay preview
- value proposition
- leaderboard teaser

#### Game screen

- target render panel
- Typst editor panel
- timer
- score
- streak indicator
- submit action
- compile/error feedback
- keyboard-shortcut hints

#### Result UX

- final score
- percentile or rank preview
- round-by-round review
- match tier explanation for accepted answers

### Frontend state strategy

- Server-owned state through TanStack Query
- Local ephemeral game UI state through Zustand
- Editor state local to game route

### UX details worth shipping in MVP

- low-latency keyboard-first flow
- optimistic transition to next round after accepted submission
- subtle animation and sound hooks
- clear feedback when answer is accepted via non-exact tier

## 9. Typst Rendering Service Design

This service is the heart of the game’s trust model.

### Responsibilities

- compile Typst source to SVG
- capture structured compiler outcome
- normalize SVG output
- compute render fingerprint
- store artifacts
- operate in an isolated environment

### Service shape

MVP:

- BullMQ worker in separate container
- Invokes Typst CLI with strict timeouts and resource limits
- Writes temp files inside isolated working directory

Later:

- dedicated render microservice with persistent worker pool
- prewarmed sandboxes for lower latency

### Inputs

- source string
- compilation mode metadata
- expected prompt constraints

### Outputs

- compile status
- stderr/stdout excerpt
- raw SVG
- normalized SVG
- render fingerprint
- metrics:
- compile duration
- output size
- memory estimate if available

### Canonical prompt pipeline

1. Admin creates prompt with canonical source.
2. Render worker compiles it.
3. Normalized source and render fingerprint are stored.
4. Optional alternates are pre-rendered and stored as approved equivalence cases.
5. Prompt becomes active only after successful generation.

## 10. Advanced Answer-Checking Design

This is the most important section of the system.

### Goals

- accept multiple valid Typst formulations
- keep verdicts deterministic and explainable
- minimize expensive render work
- avoid false positives
- support future checker improvements without invalidating old data

### Tiered strategy

#### Tier 1: Exact source match

Compare raw submission to canonical source exactly.

Pros:

- fastest
- fully deterministic
- strongest signal of mastery

Use case:

- speed-focused scoring bonus

#### Tier 2: Normalized source match

Compare normalized submission to normalized canonical source.

Normalization should be conservative in MVP.

Recommended normalization rules:

- trim leading and trailing whitespace
- normalize line endings
- collapse repeated spaces outside string literals
- normalize indentation
- remove trailing spaces
- standardize obvious spacing around operators and commas where safe

Do not over-normalize in MVP if it risks changing semantics.

#### Tier 3: Rendered SVG equivalence

If source-based comparison fails, compile the submission and compare normalized render output to the prompt’s canonical render.

Recommended render-equivalence approach:

1. Compile both canonical and submission to SVG.
2. Canonical SVG is pre-generated and stored.
3. Normalize SVG by:
- removing nondeterministic ids
- sorting attributes when serializing
- stripping metadata/comments
- normalizing insignificant whitespace
- canonicalizing numeric precision
- replacing generated element ids with deterministic placeholders
4. Compute a fingerprint from the normalized SVG.
5. Compare exact normalized SVG hash first.
6. If needed, compare structural fingerprints:
- node sequence
- path data
- text nodes
- viewBox
- bounding boxes if extracted

For MVP, exact hash of normalized SVG plus a small structural fallback is enough.

#### Tier 4: Accepted alternate answers

Store explicit alternates for cases where:

- Typst produces equivalent visuals but normalization/render hashing is not stable enough
- semantic shorthand forms should be accepted intentionally
- human-reviewed exceptions are desirable

Alternates should be versioned and tied to prompt id.

### Checker algorithm

1. Receive submission.
2. Enforce max input size.
3. Run lexical safety precheck.
4. Tier 1 exact comparison.
5. Tier 2 normalized comparison.
6. Tier 4 alternate-source quick match if alternates are stored as normalized strings.
7. If still unresolved, enqueue or run render check.
8. Compile submission in sandbox.
9. If compile fails, verdict is `compile_error`.
10. Normalize SVG and compare fingerprint to canonical.
11. If equal, accept with `rendered` tier.
12. Otherwise test explicit alternate render fingerprints.
13. Return final verdict with explanation metadata.

### Data to store per prompt

- `canonical_source`
- `normalized_canonical_source`
- `canonical_render_fingerprint`
- `checker_version`
- `accepted_alternates_json`
- optional `alternate_render_fingerprints`

### Data to store per submission

- raw source
- normalized source
- checker version used
- match tier
- compile diagnostics
- submission render fingerprint if compiled

### Versioning

The checker must be versioned.

Reason:

- normalization rules will evolve
- SVG equivalence logic will improve
- old runs should remain auditable

Add a `checker_version` field to prompts and submission verdict metadata.

## 11. Security and Sandboxing Considerations

User-submitted Typst input is untrusted code-like content and must be treated accordingly.

### Threats

- pathological compile inputs causing CPU exhaustion
- memory abuse
- filesystem access attempts through Typst features or includes
- network access attempts through external resources
- oversized outputs
- queue flooding and denial of service
- crafted payloads targeting parser bugs

### Security controls

#### Isolation

- Run user compilation in separate containers or sandboxed subprocesses.
- Disable network access for render workers.
- Use read-only base image where possible.
- Mount only a temp working directory.

#### Resource limits

- hard timeout per compile
- memory limits at container level
- max file size for source input
- max output SVG size
- bounded concurrency per worker

#### Input restrictions

- restrict submission length
- optionally restrict allowed Typst features for MVP
- reject or strip external file references
- reject imports/includes outside approved temp workspace

#### Operational protections

- per-user and per-IP rate limits
- Redis-backed submission throttling
- queue depth alarms
- structured audit logs for suspicious compile patterns

### Practical MVP rule

Do not allow arbitrary filesystem-dependent Typst features in player submissions.

Keep prompts self-contained and compile them in a workspace that contains only the submission file plus minimal assets required by that prompt.

## 12. Deployment Plan

Use a Docker-first architecture from day one.

### Local development

Docker Compose services:

- `web`
- `api`
- `worker`
- `postgres`
- `redis`
- `nginx` optional
- `minio` optional for local object storage emulation

### Production topology

- `web` container
- `api` container
- `worker` container with autoscaling support
- managed PostgreSQL
- managed Redis
- object storage bucket
- reverse proxy or cloud load balancer

### Platform options

Good solo-friendly options:

- Railway
- Render
- Fly.io
- Hetzner VPS with Docker Compose if cost-sensitive

Recommendation:

- Railway or Render for MVP velocity
- Fly.io if you want tighter Docker and regional control

### CI/CD

- GitHub Actions
- steps:
- typecheck
- lint
- unit tests
- integration tests
- build containers
- run migrations
- deploy

## 13. Testing Strategy

Treat the checker and render service as critical infrastructure.

### Unit tests

- source normalization rules
- score calculation
- prompt selection
- leaderboard aggregation
- API validation

### Integration tests

- run creation and submission flow
- queue-driven render job execution
- compile error handling
- accepted alternate path
- daily challenge generation

### Golden tests

Use a fixture suite of prompt sources and expected normalized SVG fingerprints.

This is especially important for:

- canonical rendering
- checker-version migrations
- regression detection after Typst upgrades

### Security and abuse tests

- oversized payload rejection
- timeout enforcement
- bad include/import attempts
- repeated rapid submissions

### End-to-end tests

- guest playthrough
- authenticated ranked run
- leaderboard visibility
- result review flow

### Manual QA checklist

- typing latency
- editor usability
- mobile layout integrity
- score consistency across retries
- non-exact accepted answers display clearly

## 14. Extensibility for Daily Challenges, Multiplayer, and Leaderboards

Design the MVP so future modes reuse the same core prompt, run, and verdict primitives.

### Daily challenges

Model:

- one deterministic prompt set per calendar date
- everyone gets same ordering and scoring rules

Implementation notes:

- store `challenge_date`, `seed`, and prompt set version
- separate leaderboard scope by date
- lock resubmission policy explicitly

### Multiplayer

For realistic solo scope, build asynchronous multiplayer first.

Suggested progression:

1. ghost races against recorded runs
2. async head-to-head with same prompt seed
3. real-time rooms later

This allows the same `runs` and `run_rounds` tables to power multiplayer with minimal redesign.

### Leaderboards

Design leaderboards as a derived read model.

Benefits:

- easier recomputation
- easier fraud review
- supports multiple scopes

Scopes to support:

- global all-time
- weekly
- daily
- friends
- event-based

## Recommended MVP Build Plan

### Phase 1: Foundation

- monorepo setup
- Docker Compose
- auth
- prompt schema
- canonical prompt ingestion
- Typst worker with sandbox and SVG generation

### Phase 2: Gameplay loop

- run creation
- round progression
- scoring
- exact and normalized checker
- basic game UI

### Phase 3: Advanced checker

- render-equivalence worker path
- SVG normalization
- checker versioning
- alternate-answer support

### Phase 4: Competitive layer

- profiles
- leaderboards
- polished result flow
- analytics and ops visibility

## Recommended Project Structure

```text
typ-nique/
  apps/
    web/
    api/
    worker/
  packages/
    ui/
    config/
    types/
    checker/
    typst-utils/
  infra/
    docker/
    nginx/
  prisma/
  docs/
```

## Final Recommendation

To maximize resume value and keep scope sane, build Typ-Nique as a TypeScript monorepo with:

- Next.js frontend
- NestJS API
- PostgreSQL
- Redis + BullMQ
- isolated Typst worker service
- Docker-first local and production setup

The strongest technical story is the answer-checking system:

- canonical prompt generation
- checker versioning
- safe sandboxed compilation
- layered equivalence from exact source to rendered SVG

That gives the project a clear systems-design centerpiece while still being realistic for a solo developer to ship as an MVP.
