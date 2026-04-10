import { expect, test } from "@playwright/test";

const sessionState = {
  id: "session-1",
  status: "active",
  mode: "practice",
  startedAt: "2026-04-04T12:00:00.000Z",
  endsAt: "2026-04-04T12:03:00.000Z",
  durationMs: 180000,
  timeRemainingMs: 170000,
  score: 0,
  solvedCount: 0,
  attemptedCount: 0,
  accuracy: 0,
  streak: 0,
  lastResult: null,
  currentRound: {
    sessionId: "session-1",
    roundId: "round-1",
    score: 0,
    streak: 0,
    pointsAvailable: 75,
    streakMultiplier: 1,
    roundNumber: 1,
    timeRemainingMs: 170000,
    challenge: {
      id: "challenge-1",
      slug: "pythagorean-identity",
      title: "Pythagorean Identity",
      category: "basic-math",
      difficulty: "easy",
      inputMode: "math",
      renderedSvg: '<svg viewBox="0 0 10 10"><text>x²+y²=z²</text></svg>',
      renderHash: "render-hash-1"
    }
  }
};

test("completes a practice run and lands on results", async ({ page }) => {
  await page.route("**/api/v1/game-sessions", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ data: sessionState })
    });
  });

  await page.route("**/api/v1/render/preview", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        svg: "<svg></svg>",
        renderHash: "render-hash-1",
        effectiveSource: "$ x^2 + y^2 = z^2 $",
        autoWrappedMath: true,
        inputMode: "math"
      })
    });
  });

  await page.route("**/api/v1/submissions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          verdict: "correct",
          matchTier: "rendered",
          normalizedSource: "x^2+y^2=z^2",
          feedback: "Accepted. Your answer matches the target output.",
          sessionState: {
            ...sessionState,
            status: "completed",
            score: 125,
            solvedCount: 1,
            attemptedCount: 1,
            accuracy: 1,
            currentRound: null,
            lastResult: {
              verdict: "correct",
              matchTier: "rendered",
              scoreAwarded: 125,
              feedback: "Accepted. Your answer matches the target output."
            }
          }
        }
      })
    });
  });

  await page.route("**/api/v1/game-sessions/session-1/results", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: "session-1",
          status: "completed",
          mode: "practice",
          score: 125,
          solvedCount: 1,
          attemptedCount: 1,
          accuracy: 1,
          startedAt: "2026-04-04T12:00:00.000Z",
          endedAt: "2026-04-04T12:00:20.000Z",
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
              matchTier: "rendered",
              scoreAwarded: 125,
              submittedSource: "x^2 + y^2 = z^2",
              feedback: "Accepted. Your answer matches the target output."
            }
          ]
        }
      })
    });
  });

  await page.route("**/api/v1/leaderboards/personal?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          runId: "session-1",
          bestScores: [],
          recentRuns: [],
          guestMode: true
        }
      })
    });
  });

  await page.goto("/play");

  await expect(page.getByText("Pythagorean Identity")).toBeVisible();
  await page.getByRole("textbox", { name: "Editor" }).fill("x^2 + y^2 = z^2");

  await expect(page).toHaveURL(/\/results\/session-1$/);
  await expect(page.getByText("Run Complete")).toBeVisible();
  await expect(page.getByText("125", { exact: true })).toBeVisible();
});
