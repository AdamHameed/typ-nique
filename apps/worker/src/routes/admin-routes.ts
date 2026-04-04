import type { FastifyInstance } from "fastify";
import { env } from "../lib/env.js";
import { getRenderCacheState } from "../renderer/cache.js";
import { getRenderConcurrencyState } from "../renderer/concurrency.js";
import { getRendererAdminState } from "../renderer/service.js";

export async function adminRoutes(app: FastifyInstance) {
  app.get("/internal/render/admin/state", async (request, reply) => {
    if (!isAuthorized(request.headers["x-render-admin-token"])) {
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
  if (!env.RENDER_ADMIN_TOKEN) {
    return false;
  }

  if (Array.isArray(token)) {
    return token.includes(env.RENDER_ADMIN_TOKEN);
  }

  return token === env.RENDER_ADMIN_TOKEN;
}
