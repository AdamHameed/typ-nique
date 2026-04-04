import { describe, expect, it } from "vitest";
import {
  normalizeTypstSource,
  toComparableSource,
  toRenderableTypstSource,
  toRenderableTypstSourceForMode
} from "../src/index.js";

describe("Typst source normalization", () => {
  it("ignores whitespace-only differences outside strings", () => {
    const normalized = normalizeTypstSource('  #text(fill: red)[hello]   \n  $ 2  +  3 = 5 $  ');
    expect(normalized.normalized).toBe('#text(fill:red)[hello]\n$2+3=5$');
  });

  it("preserves spaces inside string literals", () => {
    const normalized = normalizeTypstSource('#text("hello   world")');
    expect(normalized.normalized).toBe('#text("hello   world")');
  });

  it("unwraps inline math for comparison", () => {
    expect(toComparableSource("$ x^2 + y^2 $")).toBe("x^2 + y^2");
  });

  it("wraps bare math expressions for rendering", () => {
    expect(toRenderableTypstSource("x^2 + y^2 = z^2")).toBe("$ x^2 + y^2 = z^2 $");
  });

  it("keeps text-mode content unwrapped for rendering", () => {
    expect(toRenderableTypstSourceForMode("#strong[Typst]", "text")).toBe("#strong[Typst]");
  });
});
