import { describe, expect, it } from "vitest";
import { buildDuplicateSubmissionOutcome } from "../../src/services/submission-dedup.js";

describe("buildDuplicateSubmissionOutcome", () => {
  it("reuses the accepted result for duplicate correct submissions", () => {
    const outcome = buildDuplicateSubmissionOutcome({
      submission: {
        verdict: "CORRECT",
        matchTier: "NORMALIZED",
        normalizedSource: "x+y",
        feedback: "Accepted.",
        compileError: null,
        renderFingerprint: "abc123",
        isAccepted: true
      }
    });

    expect(outcome).toMatchObject({
      verdict: "correct",
      matchTier: "normalized",
      normalizedSource: "x+y",
      feedback: "Accepted.",
      renderFingerprint: "abc123",
      queuedRenderCheck: false
    });
  });

  it("returns compile-error feedback for duplicate compile failures", () => {
    const outcome = buildDuplicateSubmissionOutcome({
      submission: {
        verdict: "COMPILE_ERROR",
        matchTier: "NONE",
        normalizedSource: "x+y",
        feedback: "Typst compile failed.",
        compileError: "Typst compile failed.",
        renderFingerprint: null,
        isAccepted: false
      }
    });

    expect(outcome).toMatchObject({
      verdict: "compile_error",
      matchTier: "none",
      compileError: "Typst compile failed.",
      queuedRenderCheck: false
    });
  });

  it("returns incorrect feedback for duplicate incorrect submissions", () => {
    const outcome = buildDuplicateSubmissionOutcome({
      submission: {
        verdict: "INCORRECT",
        matchTier: "RENDERED",
        normalizedSource: "x+y",
        feedback: "Close, but not quite.",
        compileError: null,
        renderFingerprint: "fp-1",
        isAccepted: false
      }
    });

    expect(outcome).toMatchObject({
      verdict: "incorrect",
      matchTier: "rendered",
      feedback: "Close, but not quite.",
      renderFingerprint: "fp-1",
      queuedRenderCheck: false
    });
  });
});
