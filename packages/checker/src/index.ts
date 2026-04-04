import type { ChallengePrompt, SubmissionCheckResult } from "@typ-nique/types";
import { canonicalizeSvg, compareCanonicalSvg, computeRenderHash } from "./svg-comparison.js";
import { normalizeTypstSource, toComparableSource, toRenderableTypstSource, toRenderableTypstSourceForMode } from "./source-normalization.js";
import { toLegacySubmissionCheckResult, validateAnswer, type AnswerValidationInput, type AnswerValidationResult } from "./pipeline.js";

export type { AnswerValidationInput, AnswerValidationResult } from "./pipeline.js";
export type { CanonicalSvgResult, SvgComparisonDebug, SvgComparisonResult, SvgStructuralSignature } from "./svg-comparison.js";
export type { SourceNormalizationResult } from "./source-normalization.js";

export interface RenderComparisonInput {
  submissionSource: string;
  canonicalPrompt: ChallengePrompt;
  renderedSvg?: string;
}

export function runStaticCheck(submissionSource: string, prompt: ChallengePrompt): SubmissionCheckResult {
  const result = validateAnswer({
    submissionSource,
    canonicalPrompt: {
      ...prompt,
      renderedSvg: undefined
    }
  });

  return toLegacySubmissionCheckResult(result);
}

export function compareRenderedOutput(input: RenderComparisonInput): SubmissionCheckResult {
  const result = validateAnswer({
    submissionSource: input.submissionSource,
    canonicalPrompt: input.canonicalPrompt,
    renderedSvg: input.renderedSvg
  });

  return toLegacySubmissionCheckResult(result);
}

export function normalizeSource(source: string) {
  return normalizeTypstSource(source).normalized;
}

export {
  validateAnswer,
  toLegacySubmissionCheckResult,
  normalizeTypstSource,
  toComparableSource,
  toRenderableTypstSource,
  toRenderableTypstSourceForMode,
  canonicalizeSvg,
  compareCanonicalSvg,
  computeRenderHash
};
