import { describe, expect, it } from "vitest";
import { compareCanonicalSvg, validateAnswer } from "../src/index.js";
import { makePrompt } from "./helpers.js";

describe("Render equivalence logic", () => {
  it("accepts canonical SVG matches after id normalization", () => {
    const canonicalSvg =
      '<svg viewBox="0 0 10 10"><defs><path id="glyph-a" d="M 0 0 L 1 1"/></defs><use fill="#000" xlink:href="#glyph-a"/></svg>';
    const submissionSvg =
      '<svg viewBox="0 0 10 10"><defs><path d="M 0 0 L 1 1" id="random-42"/></defs><use xlink:href="#random-42" fill="#000"/></svg>';

    const comparison = compareCanonicalSvg(canonicalSvg, submissionSvg);

    expect(comparison.equivalent).toBe(true);
    expect(comparison.strategy).toBe("hash");
    expect(comparison.debug.differences).toEqual([]);
  });

  it("surfaces meaningful differences for non-equivalent SVGs", () => {
    const canonicalSvg = '<svg viewBox="0 0 10 10"><path d="M 0 0 L 1 1"/></svg>';
    const submissionSvg = '<svg viewBox="0 0 20 20"><text>hello</text></svg>';

    const comparison = compareCanonicalSvg(canonicalSvg, submissionSvg);

    expect(comparison.equivalent).toBe(false);
    expect(comparison.strategy).toBe("none");
    expect(comparison.debug.differences.join("\n")).toMatch(/viewBox differs|path count differs|text node count differs/i);
  });

  it("accepts rendered equivalence when source tiers fail", () => {
    const result = validateAnswer({
      submissionSource: "$a != b$",
      canonicalPrompt: makePrompt(),
      renderedSvg:
        '<svg viewBox="0 0 10 10"><defs><path d="M 0 0 L 1 1" id="random-42"/></defs><use xlink:href="#random-42" fill="#000"/></svg>'
    });

    expect(result.passed).toBe(true);
    expect(result.matchTier).toBe("rendered");
    expect(result.debug.render?.comparisonStrategy).toBe("hash");
  });
});
