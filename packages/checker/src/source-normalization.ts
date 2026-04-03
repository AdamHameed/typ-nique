import { createHash } from "node:crypto";

export interface SourceNormalizationResult {
  original: string;
  normalized: string;
  hash: string;
  lineCount: number;
}

export function normalizeTypstSource(source: string): SourceNormalizationResult {
  const normalized = normalizeWhitespacePreservingStrings(source);

  return {
    original: source,
    normalized,
    hash: sha256(normalized),
    lineCount: normalized.length === 0 ? 0 : normalized.split("\n").length
  };
}

function normalizeWhitespacePreservingStrings(source: string) {
  const input = source.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const output: string[] = [];

  let inString = false;
  let pendingWhitespace = false;
  let previousNonWhitespace = "";

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;
    const prev = input[index - 1] ?? "";

    if (char === "\"" && prev !== "\\") {
      if (!inString && pendingWhitespace && shouldEmitSpace(previousNonWhitespace, char)) {
        output.push(" ");
      }

      pendingWhitespace = false;
      output.push(char);
      previousNonWhitespace = char;
      inString = !inString;
      continue;
    }

    if (inString) {
      output.push(char);
      continue;
    }

    if (char === "\n") {
      trimTrailingWhitespace(output);
      if (output.length > 0 && output[output.length - 1] !== "\n") {
        output.push("\n");
      }

      pendingWhitespace = false;
      previousNonWhitespace = "\n";
      continue;
    }

    if (char === " " || char === "\t") {
      pendingWhitespace = true;
      continue;
    }

    if (pendingWhitespace && shouldEmitSpace(previousNonWhitespace, char)) {
      output.push(" ");
    }

    pendingWhitespace = false;
    output.push(char);

    if (!/\s/.test(char)) {
      previousNonWhitespace = char;
    }
  }

  trimTrailingWhitespace(output);

  return output
    .join("")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();
}

function shouldEmitSpace(previous: string, next: string) {
  if (!previous || previous === "\n") {
    return false;
  }

  if (isRightTightPunctuation(next)) {
    return false;
  }

  if (isLeftTightPunctuation(previous)) {
    return false;
  }

  return true;
}

function isLeftTightPunctuation(char: string) {
  return /[([{,;=+\-*/^_:$]/.test(char);
}

function isRightTightPunctuation(char: string) {
  return /[)\]},;=+\-*/^_:$]/.test(char);
}

function trimTrailingWhitespace(output: string[]) {
  while (output.length > 0 && output[output.length - 1] === " ") {
    output.pop();
  }
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
