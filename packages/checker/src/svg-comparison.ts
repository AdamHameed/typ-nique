import { createHash } from "node:crypto";

export interface CanonicalSvgResult {
  original: string;
  canonicalSvg: string;
  hash: string;
  structuralSignature: SvgStructuralSignature;
}

export interface SvgStructuralSignature {
  nodeCount: number;
  pathCount: number;
  useCount: number;
  textCount: number;
  groupCount: number;
  viewBox: string | null;
  textContentHash: string;
  pathDataHash: string;
  fillPaletteHash: string;
}

export interface SvgComparisonResult {
  equivalent: boolean;
  strategy: "hash" | "structure" | "none";
  canonicalHash: string;
  submissionHash: string;
  canonicalSignature: SvgStructuralSignature;
  submissionSignature: SvgStructuralSignature;
  debug: SvgComparisonDebug;
}

export interface SvgComparisonDebug {
  tolerance: {
    numericPrecisionDecimals: number;
    ignoredDifferences: string[];
  };
  differences: string[];
  canonicalPreview: string;
  submissionPreview: string;
}

export function canonicalizeSvg(svg: string): CanonicalSvgResult {
  const withoutXml = svg
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();

  const remapped = remapSvgIdentifiers(withoutXml);
  const numericNormalized = normalizeNumericPrecision(remapped);
  const tagsNormalized = sortTagAttributes(numericNormalized)
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();

  const signature = buildStructuralSignature(tagsNormalized);

  return {
    original: svg,
    canonicalSvg: tagsNormalized,
    hash: sha256(tagsNormalized),
    structuralSignature: signature
  };
}

export function computeRenderHash(svg: string): string {
  return canonicalizeSvg(svg).hash;
}

export function compareCanonicalSvg(canonicalSvg: string, submissionSvg: string): SvgComparisonResult {
  const canonical = canonicalizeSvg(canonicalSvg);
  const submission = canonicalizeSvg(submissionSvg);

  if (canonical.hash === submission.hash) {
    return {
      equivalent: true,
      strategy: "hash",
      canonicalHash: canonical.hash,
      submissionHash: submission.hash,
      canonicalSignature: canonical.structuralSignature,
      submissionSignature: submission.structuralSignature,
      debug: {
        tolerance: tolerancePolicy(),
        differences: [],
        canonicalPreview: previewSvg(canonical.canonicalSvg),
        submissionPreview: previewSvg(submission.canonicalSvg)
      }
    };
  }

  const structureEquivalent = signaturesEqual(canonical.structuralSignature, submission.structuralSignature);
  const differences = buildDifferenceSummary(canonical, submission);

  return {
    equivalent: structureEquivalent,
    strategy: structureEquivalent ? "structure" : "none",
    canonicalHash: canonical.hash,
    submissionHash: submission.hash,
    canonicalSignature: canonical.structuralSignature,
    submissionSignature: submission.structuralSignature,
    debug: {
      tolerance: tolerancePolicy(),
      differences,
      canonicalPreview: previewSvg(canonical.canonicalSvg),
      submissionPreview: previewSvg(submission.canonicalSvg)
    }
  };
}

function remapSvgIdentifiers(svg: string) {
  const idMatches = [...svg.matchAll(/\sid="([^"]+)"/g)];
  const idMap = new Map<string, string>();

  for (const [index, match] of idMatches.entries()) {
    idMap.set(match[1]!, `id${index + 1}`);
  }

  let normalized = svg;

  for (const [originalId, stableId] of idMap.entries()) {
    const escaped = escapeRegExp(originalId);
    normalized = normalized
      .replace(new RegExp(`id="${escaped}"`, "g"), `id="${stableId}"`)
      .replace(new RegExp(`xlink:href="#${escaped}"`, "g"), `xlink:href="#${stableId}"`)
      .replace(new RegExp(`href="#${escaped}"`, "g"), `href="#${stableId}"`)
      .replace(new RegExp(`url\\(#${escaped}\\)`, "g"), `url(#${stableId})`);
  }

  return normalized;
}

function normalizeNumericPrecision(svg: string) {
  return svg.replace(/-?\d+\.\d+/g, (value) => {
    const normalized = Number.parseFloat(value).toFixed(4);
    return normalized.replace(/\.?0+$/g, "");
  });
}

function sortTagAttributes(svg: string) {
  return svg.replace(/<([a-zA-Z0-9:_-]+)([^<>]*?)>/g, (fullMatch, tagName: string, rawAttrs: string) => {
    const trimmed = rawAttrs.trim();

    if (!trimmed || trimmed.startsWith("/") || trimmed === "/") {
      return `<${tagName}${trimmed ? ` ${trimmed}` : ""}>`;
    }

    const selfClosing = trimmed.endsWith("/");
    const attrBody = selfClosing ? trimmed.slice(0, -1).trim() : trimmed;
    const attributes = [...attrBody.matchAll(/([:@a-zA-Z0-9_-]+)="([^"]*)"/g)].map((match) => ({
      key: match[1]!,
      value: match[2]!
    }));

    attributes.sort((left, right) => left.key.localeCompare(right.key));

    const serialized = attributes.map((attr) => `${attr.key}="${attr.value}"`).join(" ");
    return `<${tagName}${serialized ? ` ${serialized}` : ""}${selfClosing ? " /" : ""}>`;
  });
}

function buildStructuralSignature(svg: string): SvgStructuralSignature {
  const paths = [...svg.matchAll(/<path\b[^>]*\sd="([^"]*)"/g)].map((match) => match[1]!);
  const texts = [...svg.matchAll(/<text\b[^>]*>(.*?)<\/text>/g)].map((match) => match[1]!);
  const fills = [...svg.matchAll(/\sfill="([^"]+)"/g)].map((match) => match[1]!).sort();
  const viewBoxMatch = svg.match(/\sviewBox="([^"]+)"/);

  return {
    nodeCount: (svg.match(/<([a-zA-Z][\w:-]*)\b/g) ?? []).length,
    pathCount: (svg.match(/<path\b/g) ?? []).length,
    useCount: (svg.match(/<use\b/g) ?? []).length,
    textCount: (svg.match(/<text\b/g) ?? []).length,
    groupCount: (svg.match(/<g\b/g) ?? []).length,
    viewBox: viewBoxMatch?.[1] ?? null,
    textContentHash: sha256(texts.join("|")),
    pathDataHash: sha256(paths.join("|")),
    fillPaletteHash: sha256(fills.join("|"))
  };
}

function signaturesEqual(left: SvgStructuralSignature, right: SvgStructuralSignature) {
  return (
    left.nodeCount === right.nodeCount &&
    left.pathCount === right.pathCount &&
    left.useCount === right.useCount &&
    left.textCount === right.textCount &&
    left.groupCount === right.groupCount &&
    left.viewBox === right.viewBox &&
    left.textContentHash === right.textContentHash &&
    left.pathDataHash === right.pathDataHash &&
    left.fillPaletteHash === right.fillPaletteHash
  );
}

function buildDifferenceSummary(left: CanonicalSvgResult, right: CanonicalSvgResult) {
  const differences: string[] = [];

  if (left.structuralSignature.nodeCount !== right.structuralSignature.nodeCount) {
    differences.push(
      `node count differs (${left.structuralSignature.nodeCount} vs ${right.structuralSignature.nodeCount})`
    );
  }

  if (left.structuralSignature.pathCount !== right.structuralSignature.pathCount) {
    differences.push(
      `path count differs (${left.structuralSignature.pathCount} vs ${right.structuralSignature.pathCount})`
    );
  }

  if (left.structuralSignature.useCount !== right.structuralSignature.useCount) {
    differences.push(
      `use count differs (${left.structuralSignature.useCount} vs ${right.structuralSignature.useCount})`
    );
  }

  if (left.structuralSignature.textCount !== right.structuralSignature.textCount) {
    differences.push(
      `text node count differs (${left.structuralSignature.textCount} vs ${right.structuralSignature.textCount})`
    );
  }

  if (left.structuralSignature.viewBox !== right.structuralSignature.viewBox) {
    differences.push(
      `viewBox differs (${String(left.structuralSignature.viewBox)} vs ${String(right.structuralSignature.viewBox)})`
    );
  }

  if (left.structuralSignature.pathDataHash !== right.structuralSignature.pathDataHash) {
    differences.push("path geometry differs after canonicalization");
  }

  if (left.structuralSignature.textContentHash !== right.structuralSignature.textContentHash) {
    differences.push("text content differs after canonicalization");
  }

  if (left.structuralSignature.fillPaletteHash !== right.structuralSignature.fillPaletteHash) {
    differences.push("fill colors differ after canonicalization");
  }

  if (differences.length === 0 && left.hash !== right.hash) {
    differences.push("canonical SVG hashes differ even though structural summary matched");
  }

  return differences;
}

function tolerancePolicy() {
  return {
    numericPrecisionDecimals: 4,
    ignoredDifferences: [
      "XML declarations",
      "comments and metadata whitespace",
      "attribute ordering",
      "compiler-generated id names and references",
      "minor numeric precision noise after rounding to 4 decimals"
    ]
  };
}

function previewSvg(svg: string) {
  return svg.slice(0, 200);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
