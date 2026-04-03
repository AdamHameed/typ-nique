# Challenge Content System

## JSON format

Typ-Nique challenge content lives in [data/challenges/core-pack.json](/Users/adam/Downloads/Projects/typ-nique/data/challenges/core-pack.json).

Each pack has:

- `version`
- `pack`
- `challenges`

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
- `status`

## Validation rules

- `id` must be unique within the pack.
- `slug` must be unique and kebab-case.
- `difficulty` must be `easy`, `medium`, or `hard`.
- `category` must be one of:
- `basic-math`
- `fractions`
- `superscripts-subscripts`
- `matrices`
- `alignment-layout`
- `symbols`
- `text-formatting`
- `mixed-expressions`
- `tags` must be non-empty.
- `canonical_typst_source` must be present.
- alternate sources must be unique and must not duplicate canonical source after trimming.
- `target_render_svg` and `target_render_hash` must either both be present or both be `null`.
- `estimated_solve_time` is stored in seconds and must be between `5` and `300`.

Validation is implemented in [packages/validation/src/index.ts](/Users/adam/Downloads/Projects/typ-nique/packages/validation/src/index.ts) and can be run with:

```bash
pnpm content:validate
```

## Seed pipeline

Source of truth:

- [data/challenges/core-pack.json](/Users/adam/Downloads/Projects/typ-nique/data/challenges/core-pack.json)

Pipeline:

1. Validate challenge pack.
2. Pre-render canonical SVG output.
3. Compute normalized render hashes.
4. Seed categories, tags, challenges, alternate sources, render artifacts, and daily challenge entries into PostgreSQL.

Commands:

```bash
pnpm content:validate
pnpm content:render
pnpm content:hash
pnpm content:seed
```

For local environments without Typst installed:

```bash
pnpm content:render -- --placeholder --force
```

That generates placeholder SVGs so the content system can still be exercised end to end.

## Scripts

- [scripts/challenges/validate.ts](/Users/adam/Downloads/Projects/typ-nique/scripts/challenges/validate.ts): validates JSON challenge packs.
- [scripts/challenges/render.ts](/Users/adam/Downloads/Projects/typ-nique/scripts/challenges/render.ts): compiles canonical Typst source into SVG using `typst compile`, or placeholder SVGs with `--placeholder`.
- [scripts/challenges/hash.ts](/Users/adam/Downloads/Projects/typ-nique/scripts/challenges/hash.ts): computes normalized SVG hashes.
- [scripts/challenges/seed.ts](/Users/adam/Downloads/Projects/typ-nique/scripts/challenges/seed.ts): validates then runs DB seeding.

## Notes

- `target_render_svg` is stored inline in the pack right now for portability and simplicity.
- In production, large SVG artifacts should move to object storage, while the pack keeps a storage key plus hash.
- `hint` should help without revealing exact syntax.
- `explanation` should be short but educational enough to make review screens feel rewarding.
