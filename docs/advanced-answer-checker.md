# Advanced Answer Checker

## Goals

- low false negatives
- predictable performance
- safe execution boundaries
- easy debugging
- forward-compatible heuristics
- clear explanations for every verdict

## Tiered pipeline

1. Exact source match
2. Normalized source match
3. Accepted alternate source match
4. Rendered output equivalence
5. Optional structural heuristics

The checker stops at the first strong positive match unless explicitly configured to continue for auditing.

## 1. Typst source normalization rules

Normalization is intentionally conservative. It should reduce formatting noise without changing semantics.

Rules:

- normalize line endings to `\n`
- trim leading and trailing blank lines
- remove trailing spaces on each line
- collapse repeated spaces and tabs outside string literals
- normalize spaces around common punctuation where safe:
- commas
- semicolons
- parentheses/brackets/braces
- operators like `=`, `+`, `-`, `*`, `/`
- preserve whitespace inside string literals
- preserve line structure enough for debugging output

Not attempted yet:

- AST-level Typst normalization
- reordering named arguments
- semantic normalization of macros or imports

## 2. Render comparison strategy

Render comparison is the expensive fallback.

Steps:

1. compile submitted Typst to SVG in the renderer sandbox
2. canonicalize SVG
3. compare exact canonicalized SVG hash
4. if hashes differ, compare structural signatures

Structural signatures are a future-friendly bridge between strict equality and more heuristic matching.

MVP structural fallback currently compares:

- total node count
- path count
- use count
- text node count
- group count
- viewBox
- hashed path geometry
- hashed text content
- hashed fill palette

## 3. SVG canonicalization strategy

Typst SVG output contains unstable details such as generated glyph ids.

Canonicalization:

- remove XML declarations and comments
- normalize whitespace
- remap unstable `id="..."` values to deterministic placeholders
- rewrite references:
- `href`
- `xlink:href`
- `url(#...)`
- sort attributes alphabetically inside each tag
- normalize numeric precision to a fixed number of decimals
- collapse redundant whitespace between tags

This means the checker does not rely on raw SVG string equality. It first canonicalizes the markup, then hashes that normalized form.

This dramatically reduces false negatives from compiler-generated identifier churn.

## 4. Whitespace and order differences

Source side:

- whitespace differences outside literals are normalized
- canonical and alternate forms are normalized before comparison

SVG side:

- attribute ordering is canonicalized
- insignificant whitespace is removed
- referenced ids are remapped deterministically
- harmless precision noise is rounded to 4 decimals

## 5. Semantically equivalent but syntactically different answers

Handled in layers:

- normalization covers formatting-only differences
- accepted alternates cover known valid source variants
- render equivalence covers visually identical output
- structural heuristics can later soften strict SVG hash misses

## 6. Audit/debug metadata

Store:

- raw source
- normalized source
- source hashes
- checker version
- matched tier
- explanation
- confidence score
- canonical render hash
- submission render hash
- structural signature comparison summary
- compile diagnostics if render tier was used
- SVG diff/debug notes explaining what changed

## SVG MVP tolerance strategy

The SVG comparison intentionally tolerates:

- comment and XML declaration differences
- compiler-generated id differences
- attribute ordering differences
- small numeric precision differences after rounding to 4 decimals

It does not intentionally tolerate:

- different fill colors
- different text content
- different path geometry
- different viewBox values

There is one practical exception:

- if the canonicalized hashes differ but the structural signatures still match exactly, the checker can accept via the `structure` strategy as a temporary heuristic bridge for MVP.

## 7. Correctness confidence

Suggested confidence values:

- exact: `1.0`
- normalized: `0.98`
- alternate: `0.96`
- rendered exact SVG equivalence: `0.93`
- rendered structural heuristic: `0.85`
- fail: `0.0`

Confidence is for analytics and debugging, not for changing a correct/incorrect verdict in MVP.
