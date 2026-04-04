import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResultsOverview } from "../../src/components/results-overview";

describe("ResultsOverview", () => {
  it("renders summary stats and the strongest round", () => {
    render(
      <ResultsOverview
        result={{
          id: "session-1",
          status: "completed",
          mode: "practice",
          score: 380,
          solvedCount: 3,
          attemptedCount: 4,
          accuracy: 0.75,
          startedAt: "2026-04-04T12:00:00.000Z",
          endedAt: "2026-04-04T12:03:00.000Z",
          durationMs: 180000,
          rounds: [
            {
              roundId: "round-1",
              position: 1,
              challengeId: "challenge-1",
              challengeTitle: "Pythagorean Identity",
              challengeSlug: "pythagorean-identity",
              difficulty: "easy",
              verdict: "correct",
              matchTier: "normalized",
              scoreAwarded: 125
            },
            {
              roundId: "round-2",
              position: 2,
              challengeId: "challenge-2",
              challengeTitle: "Matrix Row Swap",
              challengeSlug: "matrix-row-swap",
              difficulty: "hard",
              verdict: "correct",
              matchTier: "rendered",
              scoreAwarded: 220
            }
          ]
        }}
        personal={null}
      />
    );

    expect(screen.getByText("Run Summary")).toBeInTheDocument();
    expect(screen.getByText("380")).toBeInTheDocument();
    expect(screen.getByText("Matrix Row Swap")).toBeInTheDocument();
    expect(screen.getByText(/220 points/i)).toBeInTheDocument();
  });
});
