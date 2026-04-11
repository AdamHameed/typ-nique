import type { FastifyInstance } from "fastify";
import { env } from "../lib/env.js";
import { logSecurityEvent } from "../lib/security-log.js";
import { matchesSecret } from "../lib/secrets.js";
import { getRenderCacheState } from "../renderer/cache.js";
import { getRenderConcurrencyState } from "../renderer/concurrency.js";
import { getRendererAdminState } from "../renderer/service.js";

export async function adminRoutes(app: FastifyInstance) {
  app.get("/internal/render/admin/state", async (request, reply) => {
    if (!isAuthorized(request.headers["x-render-admin-token"])) {
      logSecurityEvent("worker-admin-auth-rejected", {
        requestId: request.id,
        ip: request.ip,
        method: request.method,
        path: request.url
      });

      return reply.code(401).send({
        error: "Unauthorized."
      });
    }

    return {
      data: {
        cache: getRenderCacheState(),
        concurrency: getRenderConcurrencyState(),
        renderer: getRendererAdminState()
      }
    };
  });
}

function isAuthorized(token: string | string[] | undefined) {
  const secret = env.RENDER_ADMIN_TOKEN;

  if (!secret) {
    return false;
  }

  if (Array.isArray(token)) {
    return token.some((value) => matchesSecret(value, secret));
  }

  if (typeof token !== "string") {
    return false;
  }

  return matchesSecret(token, secret);
}
