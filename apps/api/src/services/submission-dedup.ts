import type { MatchTier, SubmissionOutcome } from "@typ-nique/types";

export interface DuplicateSubmissionRecord {
  verdict: "CORRECT" | "INCORRECT" | "COMPILE_ERROR" | "TIMEOUT";
  matchTier: "EXACT" | "NORMALIZED" | "RENDERED" | "ALTERNATE" | "NONE";
  normalizedSource: string;
  feedback: string | null;
  compileError: string | null;
  renderFingerprint: string | null;
  isAccepted: boolean;
}

export function buildDuplicateSubmissionOutcome(input: {
  submission: DuplicateSubmissionRecord;
  sessionState?: SubmissionOutcome["sessionState"];
}): SubmissionOutcome {
  if (input.submission.isAccepted) {
    return {
      verdict: "correct",
      matchTier: input.submission.matchTier.toLowerCase() as MatchTier,
      normalizedSource: input.submission.normalizedSource,
      feedback: input.submission.feedback ?? "Duplicate submission ignored; prior accepted result reused.",
      explanation: input.submission.feedback ?? "Duplicate submission ignored; prior accepted result reused.",
      renderFingerprint: input.submission.renderFingerprint ?? undefined,
      queuedRenderCheck: false,
      sessionState: input.sessionState ?? undefined
    };
  }

  if (input.submission.verdict === "COMPILE_ERROR") {
    return {
      verdict: "compile_error",
      matchTier: "none",
      normalizedSource: input.submission.normalizedSource,
      feedback: input.submission.feedback ?? "Duplicate compile-error submission ignored.",
      explanation: input.submission.feedback ?? "Duplicate compile-error submission ignored.",
      compileError: input.submission.compileError ?? undefined,
      queuedRenderCheck: false,
      sessionState: input.sessionState ?? undefined
    };
  }

  return {
    verdict: "incorrect",
    matchTier: input.submission.matchTier.toLowerCase() as MatchTier,
    normalizedSource: input.submission.normalizedSource,
    feedback: input.submission.feedback ?? "Duplicate submission ignored.",
    explanation: input.submission.feedback ?? "Duplicate submission ignored.",
    renderFingerprint: input.submission.renderFingerprint ?? undefined,
    queuedRenderCheck: false,
    sessionState: input.sessionState ?? undefined
  };
}
