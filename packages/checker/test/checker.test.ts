import test from "node:test";
import assert from "node:assert/strict";
import { compareCanonicalSvg, computeRenderHash, normalizeTypstSource, validateAnswer } from "../src/index.js";
import type { ChallengePrompt } from "@typ-nique/types";

function makePrompt(overrides: Partial<ChallengePrompt> = {}): ChallengePrompt {
  return {
    id: "challenge-1",
    slug: "prompt-1",
    title: "Prompt 1",
    category: "math",
    difficulty: "easy",
    canonicalSource: "$ 2 + 3 = 5 $",
    normalizedCanonicalSource: normalizeTypstSource("$ 2 + 3 = 5 $").normalized,
    renderedSvg:
      '<svg viewBox="0 0 10 10"><defs><path id="glyph-a" d="M 0 0 L 1 1"/></defs><use xlink:href="#glyph-a" fill="#000"/></svg>',
    acceptedAlternates: ["$2 + 3 = 5$"],
    ...overrides
  };
}

test("source normalization ignores whitespace-only differences outside strings", () => {
  const normalized = normalizeTypstSource('  #text(fill: red)[hello]   \n  $ 2  +  3 = 5 $  ');
  assert.equal(normalized.normalized, '#text(fill:red)[hello]\n$2+3=5$');
});

test("source normalization preserves spaces inside string literals", () => {
  const normalized = normalizeTypstSource('#text("hello   world")');
  assert.equal(normalized.normalized, '#text("hello   world")');
});

test("validator accepts exact canonical source", () => {
  const result = validateAnswer({
    submissionSource: "$ 2 + 3 = 5 $",
    canonicalPrompt: makePrompt()
  });

  assert.equal(result.passed, true);
  assert.equal(result.matchTier, "exact");
  assert.equal(result.confidence, 1);
});

test("validator accepts normalized source match", () => {
  const result = validateAnswer({
    submissionSource: "$2  + 3=5$",
    canonicalPrompt: makePrompt({
      acceptedAlternates: []
    })
  });

  assert.equal(result.passed, true);
  assert.equal(result.matchTier, "normalized");
});

test("validator accepts approved alternate source", () => {
  const result = validateAnswer({
    submissionSource: "$2 + 3 = 5$",
    canonicalPrompt: makePrompt({
      canonicalSource: "$ 2 + 3 = 5.0 $",
      normalizedCanonicalSource: normalizeTypstSource("$ 2 + 3 = 5.0 $").normalized,
      acceptedAlternates: ["$2 + 3 = 5$"]
    })
  });

  assert.equal(result.passed, true);
  assert.equal(result.matchTier, "alternate");
});

test("svg comparison tolerates unstable ids and attribute order", () => {
  const canonicalSvg =
    '<svg viewBox="0 0 10 10"><defs><path id="glyph-a" d="M 0 0 L 1 1"/></defs><use fill="#000" xlink:href="#glyph-a"/></svg>';
  const submissionSvg =
    '<svg viewBox="0 0 10 10"><defs><path d="M 0 0 L 1 1" id="random-42"/></defs><use xlink:href="#random-42" fill="#000"/></svg>';

  const comparison = compareCanonicalSvg(canonicalSvg, submissionSvg);

  assert.equal(comparison.equivalent, true);
  assert.equal(comparison.strategy, "hash");
  assert.deepEqual(comparison.debug.differences, []);
});

test("svg comparison falls back to structural signature when hashes differ", () => {
  const canonicalSvg = '<svg viewBox="0 0 10 10"><path d="M 0 0 L 1 1" fill="#000"/></svg>';
  const submissionSvg = '<svg viewBox="0 0 10 10"><path d="M 0 0 L 1 1" fill="#111"/></svg>';

  const comparison = compareCanonicalSvg(canonicalSvg, submissionSvg);

  assert.equal(comparison.equivalent, false);
  assert.equal(comparison.strategy, "none");
  assert.match(comparison.debug.differences.join("\n"), /fill colors differ/i);
});

test("render hash is stable across harmless svg differences", () => {
  const canonicalSvg =
    '<svg viewBox="0 0 10 10"><defs><path id="glyph-a" d="M 0.00001 0 L 1.0000001 1"/></defs><use fill="#000" xlink:href="#glyph-a"/></svg>';
  const submissionSvg =
    '<svg viewBox="0 0 10 10"><defs><path d="M 0 0 L 1 1.0000" id="tmp-id"/></defs><use xlink:href="#tmp-id" fill="#000"/></svg>';

  assert.equal(computeRenderHash(canonicalSvg), computeRenderHash(submissionSvg));
});

test("svg comparison provides structured debug output for non-equivalent svgs", () => {
  const canonicalSvg = '<svg viewBox="0 0 10 10"><path d="M 0 0 L 1 1"/></svg>';
  const submissionSvg = '<svg viewBox="0 0 20 20"><text>hello</text></svg>';

  const comparison = compareCanonicalSvg(canonicalSvg, submissionSvg);

  assert.equal(comparison.equivalent, false);
  assert.equal(comparison.strategy, "none");
  assert.ok(comparison.debug.differences.length > 0);
  assert.match(comparison.debug.differences.join("\n"), /viewBox differs|path count differs|text node count differs/i);
});

test("svg comparison uses structural fallback when canonical hashes differ but structure is equivalent", () => {
  const canonicalSvg = '<svg viewBox="0 0 10 10"><path d="M 0 0 L 1 1" stroke="#000"/></svg>';
  const submissionSvg = '<svg viewBox="0 0 10 10"><path d="M 0 0 L 1 1" stroke="#111"/></svg>';

  const comparison = compareCanonicalSvg(canonicalSvg, submissionSvg);

  assert.equal(comparison.equivalent, true);
  assert.equal(comparison.strategy, "structure");
  assert.match(comparison.debug.differences.join("\n"), /hashes differ|structural summary matched/i);
});

test("validator accepts rendered equivalence when source tiers fail", () => {
  const result = validateAnswer({
    submissionSource: "$a != b$",
    canonicalPrompt: makePrompt(),
    renderedSvg:
      '<svg viewBox="0 0 10 10"><defs><path d="M 0 0 L 1 1" id="random-42"/></defs><use xlink:href="#random-42" fill="#000"/></svg>'
  });

  assert.equal(result.passed, true);
  assert.equal(result.matchTier, "rendered");
  assert.equal(result.debug.render?.comparisonStrategy, "hash");
});

test("validator explains failures when no tier matches", () => {
  const result = validateAnswer({
    submissionSource: "$ x^3 $",
    canonicalPrompt: makePrompt(),
    renderedSvg: '<svg viewBox="0 0 10 10"><path d="M 2 2 L 3 3"/></svg>'
  });

  assert.equal(result.passed, false);
  assert.equal(result.matchTier, "none");
  assert.match(result.explanation, /did not match canonical source/i);
  assert.equal(result.confidence, 0);
});
