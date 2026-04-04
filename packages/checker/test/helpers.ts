import type { ChallengeInputMode, ChallengePrompt } from "@typ-nique/types";
import { normalizeTypstSource } from "../src/source-normalization.js";

export function makePrompt(overrides: Partial<ChallengePrompt> = {}): ChallengePrompt {
  const canonicalSource = overrides.canonicalSource ?? "$ 2 + 3 = 5 $";
  const inputMode: ChallengeInputMode = overrides.inputMode ?? "math";

  return {
    id: "challenge-1",
    slug: "prompt-1",
    title: "Prompt 1",
    category: "basic-math",
    difficulty: "easy",
    inputMode,
    canonicalSource,
    normalizedCanonicalSource: normalizeTypstSource(canonicalSource).normalized,
    renderedSvg:
      '<svg viewBox="0 0 10 10"><defs><path id="glyph-a" d="M 0 0 L 1 1"/></defs><use xlink:href="#glyph-a" fill="#000"/></svg>',
    acceptedAlternates: ["$2 + 3 = 5$"],
    ...overrides
  };
}
