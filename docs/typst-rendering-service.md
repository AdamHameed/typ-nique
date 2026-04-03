# Typst Rendering Service

## 1. Rendering pipeline

The renderer accepts a `source` string and a `purpose`:

- `canonical`
- `submission`

Pipeline:

1. Validate request size and basic safety rules.
2. Compute a deterministic cache key from renderer version, purpose, and source hash.
3. Return cached success or failure when available.
4. Create an isolated temp workspace.
5. Write a single `main.typ` file into that workspace.
6. Invoke `typst compile main.typ main.svg --format svg`.
7. Enforce wall-clock timeout.
8. Read the generated SVG, normalize it, compute a render hash, and return structured metadata.
9. Clean up the temp workspace.

## 2. Temp file strategy

- Each render uses its own `mkdtemp` workspace under a configured temp root.
- The workspace only contains:
- `main.typ`
- `main.svg` after successful compilation
- No user-controlled filenames are used.
- Workspaces are always removed in a `finally` block.

## 3. Sandboxing strategy

Application-level:

- submissions are size-limited
- dangerous file-loading constructs are rejected conservatively during preflight
- the compiler runs in a fresh working directory with no extra assets

Container-level:

- renderer runs inside the worker container
- Docker should enforce memory and process limits
- writable temp storage should be scoped to `/tmp` or a specific temp volume

Recommended production hardening:

- dedicated renderer container or microVM
- read-only root filesystem
- dropped Linux capabilities
- no outbound internet
- low `pids_limit`

## 4. Timeout and memory controls

- Timeout is enforced in-process with a kill timer.
- Source size is capped before execution.
- SVG output size is capped after execution.
- Stderr/stdout capture is truncated.
- Memory should be enforced at the container level because Typst is an external process.

## 5. Response format

Successful responses include:

- `ok`
- `svg`
- `normalizedSvg`
- `renderHash`
- `sourceHash`
- `cached`
- `durationMs`
- `stderr`
- `metadata`

Failures include:

- `ok`
- `errorCode`
- `message`
- `durationMs`
- `cached`
- optional truncated diagnostics

## 6. Caching strategy

- In-memory TTL cache keyed by renderer version + purpose + source hash.
- Cache both successes and failures for a short period to dampen repeated abuse.
- Canonical renders benefit most because they are often deterministic and repeated.

Future improvement:

- Redis-backed distributed renderer cache

## 7. Docker integration

- Worker image should have `typst` installed or mounted at `TYPST_BIN`.
- Compose should set:
- timeout env vars
- temp root
- output size limits
- worker memory/process limits

## 8. Failure handling

The renderer distinguishes:

- `SOURCE_TOO_LARGE`
- `UNSAFE_SOURCE`
- `TIMEOUT`
- `COMPILER_NOT_FOUND`
- `COMPILE_ERROR`
- `SVG_NOT_PRODUCED`
- `OUTPUT_TOO_LARGE`
- `INTERNAL_ERROR`

Failures are structured and safe to return to higher layers without leaking raw internals by default.
