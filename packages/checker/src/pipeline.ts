import type { ChallengePrompt, MatchTier, SubmissionCheckResult, SubmissionVerdict } from "@typ-nique/types";
import { compareCanonicalSvg } from "./svg-comparison.js";
import { normalizeTypstSource } from "./source-normalization.js";

export interface AnswerValidationInput {
  submissionSource: string;
  canonicalPrompt: ChallengePrompt;
  renderedSvg?: string;
}

export interface AnswerValidationDebug {
  checkerVersion: string;
  source: {
    canonicalHash: string;
    canonicalNormalized: string;
    submissionHash: string;
    submissionNormalized: string;
    alternateNormalizedSources: string[];
  };
  render?: {
    canonicalHash: string;
    submissionHash: string;
    comparisonStrategy: "hash" | "structure" | "none";
    structuralEquivalent: boolean;
  };
}

export interface AnswerValidationResult {
  verdict: SubmissionVerdict;
  matchTier: MatchTier;
  confidence: number;
  passed: boolean;
  explanation: string;
  feedback: string;
  normalizedSource: string;
  renderFingerprint?: string;
  debug: AnswerValidationDebug;
}

const CHECKER_VERSION = "answer-checker-v1";

export function validateAnswer({
  submissionSource,
  canonicalPrompt,
  renderedSvg
}: AnswerValidationInput): AnswerValidationResult {
  const submission = normalizeTypstSource(submissionSource);
  const canonical = normalizeTypstSource(canonicalPrompt.canonicalSource);
  const alternates = canonicalPrompt.acceptedAlternates.map((alternate) => normalizeTypstSource(alternate));

  const debugBase: AnswerValidationDebug = {
    checkerVersion: CHECKER_VERSION,
    source: {
      canonicalHash: canonical.hash,
      canonicalNormalized: canonical.normalized,
      submissionHash: submission.hash,
      submissionNormalized: submission.normalized,
      alternateNormalizedSources: alternates.map((alternate) => alternate.normalized)
    }
  };

  if (submissionSource === canonicalPrompt.canonicalSource) {
    return buildResult({
      verdict: "correct",
      matchTier: "exact",
      confidence: 1,
      explanation: "Accepted because the submitted Typst source exactly matches the canonical challenge source.",
      normalizedSource: submission.normalized,
      debug: debugBase
    });
  }

  if (submission.normalized === canonical.normalized) {
    return buildResult({
      verdict: "correct",
      matchTier: "normalized",
      confidence: 0.98,
      explanation:
        "Accepted after Typst source normalization. Formatting-only differences were ignored without changing meaning.",
      normalizedSource: submission.normalized,
      debug: debugBase
    });
  }

  const matchedAlternate = alternates.find((alternate) => alternate.normalized === submission.normalized);

  if (matchedAlternate) {
    return buildResult({
      verdict: "correct",
      matchTier: "alternate",
      confidence: 0.96,
      explanation: "Accepted because the submission matches a pre-approved alternate Typst source form.",
      normalizedSource: submission.normalized,
      debug: debugBase
    });
  }

  if (!renderedSvg || !canonicalPrompt.renderedSvg) {
    return buildResult({
      verdict: "incorrect",
      matchTier: "none",
      confidence: 0,
      explanation:
        "The answer did not match canonical or alternate source forms, and rendered SVG comparison was not available.",
      normalizedSource: submission.normalized,
      debug: debugBase
    });
  }

  const renderComparison = compareCanonicalSvg(canonicalPrompt.renderedSvg, renderedSvg);

  if (renderComparison.equivalent) {
    const strategy = renderComparison.strategy === "hash" ? "exact canonical SVG equivalence" : "structural SVG equivalence";

    return buildResult({
      verdict: "correct",
      matchTier: "rendered",
      confidence: renderComparison.strategy === "hash" ? 0.93 : 0.85,
      explanation: `Accepted via rendered output comparison using ${strategy}.`,
      normalizedSource: submission.normalized,
      renderFingerprint: renderComparison.submissionHash,
      debug: {
        ...debugBase,
        render: {
          canonicalHash: renderComparison.canonicalHash,
          submissionHash: renderComparison.submissionHash,
          comparisonStrategy: renderComparison.strategy,
          structuralEquivalent: renderComparison.strategy !== "none"
        }
      }
    });
  }

  return buildResult({
    verdict: "incorrect",
    matchTier: "none",
    confidence: 0,
    explanation:
      "The answer did not match canonical source, normalized source, approved alternates, or rendered SVG equivalence.",
    normalizedSource: submission.normalized,
    renderFingerprint: renderComparison.submissionHash,
    debug: {
      ...debugBase,
      render: {
        canonicalHash: renderComparison.canonicalHash,
        submissionHash: renderComparison.submissionHash,
        comparisonStrategy: renderComparison.strategy,
        structuralEquivalent: false
      }
    }
  });
}

export function toLegacySubmissionCheckResult(result: AnswerValidationResult): SubmissionCheckResult {
  return {
    verdict: result.verdict,
    matchTier: result.matchTier,
    normalizedSource: result.normalizedSource,
    feedback: result.feedback,
    renderFingerprint: result.renderFingerprint
  };
}

function buildResult(input: {
  verdict: SubmissionVerdict;
  matchTier: MatchTier;
  confidence: number;
  explanation: string;
  normalizedSource: string;
  renderFingerprint?: string;
  debug: AnswerValidationDebug;
}): AnswerValidationResult {
  return {
    ...input,
    passed: input.verdict === "correct",
    feedback: input.explanation
  };
}
