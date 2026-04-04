import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateAnswer } from "../src/index.js";
import { makePrompt } from "./helpers.js";

interface AcceptedAnswerRegressionCase {
  name: string;
  canonicalSource: string;
  acceptedAlternates: string[];
  submissionSource: string;
  expectedVerdict: "correct" | "incorrect";
  expectedMatchTier: "exact" | "normalized" | "alternate" | "rendered" | "none";
}

const regressionFixturePath = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "fixtures",
  "accepted-answer-regressions.json"
);
const regressionCases = JSON.parse(
  readFileSync(regressionFixturePath, "utf8")
) as AcceptedAnswerRegressionCase[];

describe("Accepted-answer regressions", () => {
  for (const fixture of regressionCases) {
    it(fixture.name, () => {
      const result = validateAnswer({
        submissionSource: fixture.submissionSource,
        canonicalPrompt: makePrompt({
          canonicalSource: fixture.canonicalSource,
          acceptedAlternates: fixture.acceptedAlternates
        })
      });

      expect(result.verdict).toBe(fixture.expectedVerdict);
      expect(result.matchTier).toBe(fixture.expectedMatchTier);
    });
  }
});
