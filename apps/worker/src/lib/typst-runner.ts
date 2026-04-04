import { toRenderableTypstSourceForMode } from "@typ-nique/checker";
import { renderCanonicalChallenge, renderSubmission } from "../renderer/service.js";
import type { RenderFailure, RenderSuccess } from "../renderer/types.js";

export interface TypstCompileSuccess {
  ok: true;
  svg: string;
  stderr: string;
  renderHash: string;
  durationMs: number;
  cached: boolean;
}

export interface TypstCompileFailure {
  ok: false;
  error: string;
  errorCode: RenderFailure["errorCode"];
  stderr?: string;
  durationMs: number;
  cached: boolean;
}

export type TypstCompileResult = TypstCompileSuccess | TypstCompileFailure;

export async function compileTypstToSvg(source: string, requestId?: string): Promise<TypstCompileResult> {
  const result = await renderSubmission(toRenderableTypstSourceForMode(source, "math"), requestId);
  return mapRenderResult(result);
}

export async function compileCanonicalTypstToSvg(source: string): Promise<TypstCompileResult> {
  const result = await renderCanonicalChallenge(toRenderableTypstSourceForMode(source, "math"));
  return mapRenderResult(result);
}

function mapRenderResult(result: RenderSuccess | RenderFailure): TypstCompileResult {
  if (!result.ok) {
    return {
      ok: false,
      error: result.message,
      errorCode: result.errorCode,
      stderr: result.stderr,
      durationMs: result.durationMs,
      cached: result.cached
    };
  }

  return {
    ok: true,
    svg: result.svg,
    stderr: result.stderr,
    renderHash: result.renderHash,
    durationMs: result.durationMs,
    cached: result.cached
  };
}
