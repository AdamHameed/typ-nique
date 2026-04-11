import type { FastifyInstance } from "fastify";
import type { PreviewRenderResponse } from "@typ-nique/types";
import { toRenderableTypstSourceForMode } from "@typ-nique/checker";
import { previewRenderSchema } from "@typ-nique/validation";
import { env } from "../lib/env.js";
import { logSecurityEvent } from "../lib/security-log.js";
import { matchesSecret } from "../lib/secrets.js";
import { renderSubmission } from "../renderer/service.js";

export async function previewRoutes(app: FastifyInstance) {
  app.post("/internal/render/preview", async (request, reply) => {
    if (!isAuthorizedInternalRequest(request.headers["x-worker-internal-token"])) {
      logSecurityEvent("worker-preview-auth-rejected", {
        requestId: request.id,
        ip: request.ip,
        method: request.method,
        path: request.url
      });

      return reply.code(401).send({
        ok: false,
        errorCode: "UNAUTHORIZED",
        message: "Unauthorized."
      } satisfies PreviewRenderResponse);
    }

    const body = previewRenderSchema.parse(request.body);
    const requestId = typeof request.headers["x-request-id"] === "string" ? request.headers["x-request-id"] : crypto.randomUUID();
    const effectiveSource = toRenderableTypstSourceForMode(body.source, body.inputMode);
    let renderResult = await renderSubmission(effectiveSource, requestId);
    let finalSource = effectiveSource;

    if (!renderResult.ok && body.inputMode === "math") {
      const fallbackSource = buildMathPreviewFallback(body.source);

      if (fallbackSource && fallbackSource !== effectiveSource) {
        const fallbackResult = await renderSubmission(fallbackSource, requestId);

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
          message: renderResult.safeMessage ?? renderResult.message
        };

    return reply.code(renderResult.ok ? 200 : 422).send(payload);
  });
}

function isAuthorizedInternalRequest(token: string | string[] | undefined) {
  const secret = env.WORKER_INTERNAL_TOKEN;

  if (!secret) {
    return env.NODE_ENV !== "production";
  }

  if (Array.isArray(token)) {
    return token.some((value) => matchesSecret(value, secret));
  }

  if (typeof token !== "string") {
    return false;
  }

  return matchesSecret(token, secret);
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
