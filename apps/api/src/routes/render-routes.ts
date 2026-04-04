import type { FastifyInstance } from "fastify";
import type { PreviewRenderResponse } from "@typ-nique/types";
import { previewRenderSchema } from "@typ-nique/validation";
import { env } from "../lib/env.js";

export async function renderRoutes(app: FastifyInstance) {
  app.post("/api/v1/render/preview", async (request, reply) => {
    const body = previewRenderSchema.parse(request.body);
    try {
      const response = await fetch(`${env.WORKER_RENDER_URL}/internal/render/preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      const payload = (await response.json()) as PreviewRenderResponse;
      return reply.code(response.status).send(payload);
    } catch (error) {
      request.log.error(
        {
          error,
          workerRenderUrl: env.WORKER_RENDER_URL
        },
        "Preview render proxy failed."
      );

      return reply.code(503).send({
        ok: false,
        errorCode: "PREVIEW_UNAVAILABLE",
        message: `Preview service is unavailable at ${env.WORKER_RENDER_URL}.`
      } satisfies PreviewRenderResponse & { errorCode: string });
    }
  });
}
