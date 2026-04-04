import { describe, expect, it } from "vitest";
import { canonicalizeSvg, computeRenderHash } from "../src/index.js";

describe("SVG normalization", () => {
  it("removes XML noise, normalizes ids, and sorts attributes", () => {
    const svg = `<?xml version="1.0"?>
      <!-- generated -->
      <svg viewBox="0 0 10 10">
        <defs><path id="glyph-a" d="M 0.00001 0 L 1.0000001 1"/></defs>
        <use fill="#000" xlink:href="#glyph-a"/>
      </svg>`;

    const canonical = canonicalizeSvg(svg);

    expect(canonical.canonicalSvg).toContain('id="id1"');
    expect(canonical.canonicalSvg).toContain('xlink:href="#id1"');
    expect(canonical.canonicalSvg).not.toContain("<?xml");
    expect(canonical.canonicalSvg).not.toContain("<!--");
  });

  it("produces stable hashes for harmless numeric and id differences", () => {
    const canonicalSvg =
      '<svg viewBox="0 0 10 10"><defs><path id="glyph-a" d="M 0.00001 0 L 1.0000001 1"/></defs><use fill="#000" xlink:href="#glyph-a"/></svg>';
    const submissionSvg =
      '<svg viewBox="0 0 10 10"><defs><path d="M 0 0 L 1 1.0000" id="tmp-id"/></defs><use xlink:href="#tmp-id" fill="#000"/></svg>';

    expect(computeRenderHash(canonicalSvg)).toBe(computeRenderHash(submissionSvg));
  });
});
