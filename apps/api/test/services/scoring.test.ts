import { describe, expect, it } from "vitest";
import { scoreSubmission } from "../../src/services/scoring.js";

describe("scoreSubmission", () => {
  it("uses five points per typst source character at zero streak", () => {
    expect(scoreSubmission("x+y", 0)).toBe(15);
  });

  it("applies a 0.1 increase per streak step", () => {
    expect(scoreSubmission("12345", 2)).toBe(30);
  });

  it("caps the streak multiplier at two times", () => {
    expect(scoreSubmission("12345", 20)).toBe(50);
  });
});
