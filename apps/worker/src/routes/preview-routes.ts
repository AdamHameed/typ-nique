import type { FastifyInstance } from "fastify";
import type { PreviewRenderResponse } from "@typ-nique/types";
import { toRenderableTypstSourceForMode } from "@typ-nique/checker";
import { previewRenderSchema } from "@typ-nique/validation";
import { renderSubmission } from "../renderer/service.js";

export async function previewRoutes(app: FastifyInstance) {
  app.post("/internal/render/preview", async (request, reply) => {
    const body = previewRenderSchema.parse(request.body);
    const effectiveSource = toRenderableTypstSourceForMode(body.source, body.inputMode);
    let renderResult = await renderSubmission(effectiveSource);
    let finalSource = effectiveSource;

    if (!renderResult.ok && body.inputMode === "math") {
      const fallbackSource = buildMathPreviewFallback(body.source);

      if (fallbackSource && fallbackSource !== effectiveSource) {
        const fallbackResult = await renderSubmission(fallbackSource);

        if (fallbackResult.ok) {
          renderResult = fallbackResult;
          finalSource = fallbackSource;
        }
      }
    }

    const payload: PreviewRenderResponse = renderResult.ok
      ? {
          ok: true,
          svg: renderResult.svg,
          renderHash: renderResult.renderHash,
          effectiveSource: finalSource,
          inputMode: body.inputMode,
          autoWrappedMath: finalSource !== body.source.trim(),
          durationMs: renderResult.durationMs,
          cached: renderResult.cached
        }
      : {
          ok: false,
          effectiveSource: finalSource,
          inputMode: body.inputMode,
          autoWrappedMath: finalSource !== body.source.trim(),
          durationMs: renderResult.durationMs,
          cached: renderResult.cached,
          errorCode: renderResult.errorCode,
          message: renderResult.message
        };

    return reply.code(renderResult.ok ? 200 : 422).send(payload);
  });
}

function buildMathPreviewFallback(source: string) {
  const trimmed = source.trim();

  if (!trimmed || trimmed.startsWith("$") || trimmed.startsWith("#")) {
    return null;
  }

  if (!/^[A-Za-z][A-Za-z0-9 ]+$/.test(trimmed)) {
    return null;
  }

  return `$ "${trimmed.replaceAll("\"", "\\\"")}" $`;
}
