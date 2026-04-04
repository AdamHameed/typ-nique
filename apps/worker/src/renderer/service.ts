import { createHash } from "node:crypto";
import { normalizeSvgMarkup, svgFingerprint } from "@typ-nique/typst-utils";
import { logger } from "../lib/logger.js";
import { env } from "../lib/env.js";
import { configureRenderCache, getCachedRenderResult, setCachedRenderResult } from "./cache.js";
import { withRenderSlot } from "./concurrency.js";
import { getRenderObservabilitySnapshot, recordRenderResult } from "./observability.js";
import { runTypstCompile } from "./process.js";
import { runRenderPreflight } from "./preflight.js";
import { cleanupRenderWorkspace, cleanupStaleRenderWorkspaces, createRenderWorkspace, writeRenderSource } from "./temp-workspace.js";
import type { RenderFailure, RenderRequest, RenderResult, RenderSuccess } from "./types.js";

const RENDERER_VERSION = "v1";

export async function renderTypstToSvg(request: RenderRequest): Promise<RenderResult> {
  configureRenderCache({ maxEntries: env.RENDER_CACHE_MAX_ENTRIES });
  await cleanupStaleRenderWorkspaces({
    tempRootDir: env.TYPST_TEMP_ROOT_DIR,
    maxAgeMs: env.TYPST_WORKSPACE_MAX_AGE_MS
  });

  const sourceHash = sha256(request.source);
  const cacheKey = `${RENDERER_VERSION}:${request.purpose}:${sourceHash}`;
  const cached = getCachedRenderResult(cacheKey);

  if (cached) {
    recordRenderResult(request, cached);
    return cached;
  }

  const preflightError = runRenderPreflight(request, {
    maxSourceBytes: env.TYPST_MAX_SOURCE_BYTES
  });

  if (preflightError) {
    const failure = {
      ...preflightError,
      sourceHash
    } satisfies RenderFailure;

    setCachedRenderResult(cacheKey, failure, env.RENDER_CACHE_TTL_MS);
    recordRenderResult(request, failure);
    return failure;
  }

  return withRenderSlot(env.TYPST_MAX_CONCURRENT_RENDERS, async () => {
    const workspace = await createRenderWorkspace(env.TYPST_TEMP_ROOT_DIR);

    try {
      await writeRenderSource(workspace, request.source);

      const processResult = await runTypstCompile({
        typstBin: env.TYPST_BIN,
        workspace,
        timeoutMs: env.TYPST_TIMEOUT_MS,
        maxLogBytes: env.TYPST_MAX_LOG_BYTES,
        maxMemoryKb: env.TYPST_MAX_MEMORY_KB
      });

      if (processResult.timedOut) {
        const failure: RenderFailure = {
          ok: false,
          errorCode: "TIMEOUT",
          message: "Typst compilation exceeded the configured timeout.",
          safeMessage: "This preview took too long to render.",
          cached: false,
          durationMs: processResult.durationMs,
          stdout: processResult.stdout,
          stderr: processResult.stderr,
          sourceHash
        };

        return finalizeFailure(request, cacheKey, failure);
      }

      if (processResult.exitCode !== 0) {
        const failure: RenderFailure = {
          ok: false,
          errorCode: "COMPILE_ERROR",
          message: "Typst reported a compilation error.",
          safeMessage: "Typst could not compile that input.",
          cached: false,
          durationMs: processResult.durationMs,
          stdout: processResult.stdout,
          stderr: processResult.stderr,
          sourceHash
        };

        return finalizeFailure(request, cacheKey, failure);
      }

      if (!processResult.svg) {
        const failure: RenderFailure = {
          ok: false,
          errorCode: "SVG_NOT_PRODUCED",
          message: "Typst completed without producing an SVG artifact.",
          safeMessage: "The renderer did not produce an SVG output.",
          cached: false,
          durationMs: processResult.durationMs,
          stdout: processResult.stdout,
          stderr: processResult.stderr,
          sourceHash
        };

        return finalizeFailure(request, cacheKey, failure);
      }

      const outputBytes = Buffer.byteLength(processResult.svg, "utf8");

      if (outputBytes > env.TYPST_MAX_OUTPUT_BYTES) {
        const failure: RenderFailure = {
          ok: false,
          errorCode: "OUTPUT_TOO_LARGE",
          message: "Rendered SVG exceeds the configured output limit.",
          safeMessage: "The rendered output was too large to process safely.",
          cached: false,
          durationMs: processResult.durationMs,
          stderr: processResult.stderr,
          sourceHash
        };

        return finalizeFailure(request, cacheKey, failure);
      }

      const normalizedSvg = normalizeSvgMarkup(processResult.svg);
      const success: RenderSuccess = {
        ok: true,
        sourceHash,
        renderHash: svgFingerprint(normalizedSvg),
        svg: processResult.svg,
        normalizedSvg,
        cached: false,
        durationMs: processResult.durationMs,
        stderr: processResult.stderr,
        metadata: {
          purpose: request.purpose,
          outputBytes,
          compilerCommand: `${env.TYPST_BIN} compile main.typ main.svg --format svg`
        }
      };

      setCachedRenderResult(cacheKey, success, env.RENDER_CACHE_TTL_MS);
      recordRenderResult(request, success);
      return success;
    } catch (error) {
      const failure = mapUnexpectedRenderError(error, sourceHash);
      return finalizeFailure(request, cacheKey, failure);
    } finally {
      await cleanupRenderWorkspace(workspace);
    }
  });
}

export function renderCanonicalChallenge(source: string, requestId?: string) {
  return renderTypstToSvg({
    source,
    purpose: "canonical",
    requestId
  });
}

export function renderSubmission(source: string, requestId?: string) {
  return renderTypstToSvg({
    source,
    purpose: "submission",
    requestId
  });
}

function mapUnexpectedRenderError(error: unknown, sourceHash: string): RenderFailure {
  const message = error instanceof Error ? error.message : "Unknown renderer failure.";

  if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
    return {
      ok: false,
      errorCode: "COMPILER_NOT_FOUND",
      message: "Typst compiler binary was not found in the worker environment.",
      safeMessage: "The render service is not configured correctly right now.",
      cached: false,
      durationMs: 0,
      sourceHash
    };
  }

  return {
    ok: false,
    errorCode: "INTERNAL_ERROR",
    message,
    safeMessage: "The render service hit an internal error.",
    cached: false,
    durationMs: 0,
    sourceHash
  };
}

function finalizeFailure(request: RenderRequest, cacheKey: string, failure: RenderFailure) {
  setCachedRenderResult(cacheKey, failure, env.RENDER_FAILURE_CACHE_TTL_MS);
  recordRenderResult(request, failure);
  logger.error(
    {
      requestId: request.requestId ?? null,
      purpose: request.purpose,
      errorCode: failure.errorCode,
      durationMs: failure.durationMs,
      sourceHash: failure.sourceHash
    },
    failure.message
  );
  return failure;
}

export function getRendererAdminState() {
  return {
    ...getRenderObservabilitySnapshot()
  };
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
