import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { challengeContentPackSchema } from "@typ-nique/validation";
import { normalizeSource } from "@typ-nique/typst-utils";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../../..");

export const challengePackPath = path.join(rootDir, "data/challenges/core-pack.json");

export async function loadChallengePack() {
  const raw = await readFile(challengePackPath, "utf8");
  return challengeContentPackSchema.parse(JSON.parse(raw));
}

export function categoryLabelFromSlug(slug: string) {
  switch (slug) {
    case "basic-math":
      return "Basic Math";
    case "fractions":
      return "Fractions";
    case "superscripts-subscripts":
      return "Superscripts / Subscripts";
    case "matrices":
      return "Matrices";
    case "alignment-layout":
      return "Alignment / Layout";
    case "symbols":
      return "Symbols";
    case "text-formatting":
      return "Text Formatting";
    case "mixed-expressions":
      return "Mixed Expressions";
    default:
      return slug;
  }
}

export function difficultyToRank(difficulty: "easy" | "medium" | "hard") {
  switch (difficulty) {
    case "easy":
      return 1;
    case "medium":
      return 2;
    case "hard":
      return 3;
  }
}

export function buildChallengeDescription(hint: string, explanation: string) {
  return `${hint}\n\n${explanation}`;
}

export function normalizeAlternateSources(alternates: string[]) {
  return alternates.map((source) => ({
    sourceText: source,
    normalizedSource: normalizeSource(source)
  }));
}
