import type { RenderFailure, RenderRequest } from "./types.js";

const UNSAFE_PATTERNS = [
  /#include\s*\(/i,
  /#import\s+/i,
  /read\s*\(/i,
  /image\s*\(/i,
  /bibliography\s*\(/i,
  /raw\s*\(/i
] as const;

export function runRenderPreflight(
  request: RenderRequest,
  options: {
    maxSourceBytes: number;
  }
): RenderFailure | null {
  const sourceBytes = Buffer.byteLength(request.source, "utf8");

  if (sourceBytes > options.maxSourceBytes) {
    return {
      ok: false,
      errorCode: "SOURCE_TOO_LARGE",
      message: "Typst source exceeds the configured size limit.",
      cached: false,
      durationMs: 0
    };
  }

  const matchedPattern = UNSAFE_PATTERNS.find((pattern) => pattern.test(request.source));

  if (matchedPattern) {
    return {
      ok: false,
      errorCode: "UNSAFE_SOURCE",
      message: "Typst source uses features that are not allowed in the renderer sandbox.",
      cached: false,
      durationMs: 0
    };
  }

  return null;
}
