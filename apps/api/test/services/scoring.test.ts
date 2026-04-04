import { describe, expect, it } from "vitest";
import { scoreSubmission } from "../../src/services/scoring.js";

describe("scoreSubmission", () => {
  it("rewards faster solves more heavily", () => {
    const presentedAt = new Date("2026-04-04T12:00:00.000Z");

    const fastScore = scoreSubmission(2, presentedAt, presentedAt.getTime() + 4_000);
    const slowScore = scoreSubmission(2, presentedAt, presentedAt.getTime() + 45_000);

    expect(fastScore).toBeGreaterThan(slowScore);
  });

  it("caps the top-end speed bonus", () => {
    const presentedAt = new Date("2026-04-04T12:00:00.000Z");
    expect(scoreSubmission(1, presentedAt, presentedAt.getTime() + 200)).toBe(125);
  });

  it("applies the minimum floor for slow hard prompts", () => {
    const presentedAt = new Date("2026-04-04T12:00:00.000Z");
    expect(scoreSubmission(3, presentedAt, presentedAt.getTime() + 180_000)).toBe(121);
  });
});
