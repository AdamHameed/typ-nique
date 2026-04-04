import type { FastifyInstance } from "fastify";
import type { PreviewRenderResponse } from "@typ-nique/types";
import { toRenderableTypstSourceForMode } from "@typ-nique/checker";
import { previewRenderSchema } from "@typ-nique/validation";
import { renderSubmission } from "../renderer/service.js";

export async function previewRoutes(app: FastifyInstance) {
  app.post("/internal/render/preview", async (request, reply) => {
    const body = previewRenderSchema.parse(request.body);
    const effectiveSource = toRenderableTypstSourceForMode(body.source, body.inputMode);
    const renderResult = await renderSubmission(effectiveSource);

    const payload: PreviewRenderResponse = renderResult.ok
      ? {
          ok: true,
          svg: renderResult.svg,
          renderHash: renderResult.renderHash,
          effectiveSource,
          inputMode: body.inputMode,
          autoWrappedMath: effectiveSource !== body.source.trim(),
          durationMs: renderResult.durationMs,
          cached: renderResult.cached
        }
      : {
          ok: false,
          effectiveSource,
          inputMode: body.inputMode,
          autoWrappedMath: effectiveSource !== body.source.trim(),
          durationMs: renderResult.durationMs,
          cached: renderResult.cached,
          errorCode: renderResult.errorCode,
          message: renderResult.message
        };

    return reply.code(renderResult.ok ? 200 : 422).send(payload);
  });
}
