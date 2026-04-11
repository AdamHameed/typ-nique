import Fastify from "fastify";
import helmet from "@fastify/helmet";
import { ZodError } from "zod";
import { adminRoutes } from "./routes/admin-routes.js";
import { previewRoutes } from "./routes/preview-routes.js";
import { env } from "./lib/env.js";
import { createQueueWorker } from "./lib/queue.js";
import { logger } from "./lib/logger.js";
import { logSecurityEvent } from "./lib/security-log.js";
import { handleRenderCheckJob } from "./jobs/render-check-job.js";
import { cleanupStaleRenderWorkspaces } from "./renderer/temp-workspace.js";

const worker = createQueueWorker(async (job) => {
  const roundId =
    typeof job.data === "object" && job.data !== null && "roundId" in job.data
      ? String(job.data.roundId)
      : "unknown";

  logger.info(`Processing ${job.name} for round ${roundId}`);
  return handleRenderCheckJob(job.data);
});

worker.on("completed", (job) => {
  const roundId =
    typeof job.data === "object" && job.data !== null && "roundId" in job.data
      ? String(job.data.roundId)
      : "unknown";

  logger.info(`Completed ${job.name} for round ${roundId}`);
});

worker.on("failed", (job, error) => {
  logger.error(`Failed ${job?.name ?? "unknown"}: ${error.message}`);
});

const app = Fastify({
  bodyLimit: env.WORKER_BODY_LIMIT_BYTES,
  requestTimeout: env.WORKER_REQUEST_TIMEOUT_MS,
  requestIdHeader: "x-request-id",
  logger: false
});

await app.register(helmet);
await app.register(previewRoutes);

if (env.ENABLE_RENDER_ADMIN && env.RENDER_ADMIN_TOKEN) {
  await app.register(adminRoutes);
}

app.get("/health", async (_request, reply) => {
  reply.header("Cache-Control", "no-store");
  return { ok: true };
});

app.setNotFoundHandler((request, reply) => {
  return reply.code(404).send({
    error: "Not found.",
    requestId: request.id
  });
});

app.setErrorHandler((error, request, reply) => {
  if (reply.sent) {
    return;
  }

  const fastifyError = error as { code?: string; statusCode?: number };

  if (error instanceof ZodError && request.url.startsWith("/internal/render/preview")) {
    return reply.code(400).send({
      ok: false,
      errorCode: "INVALID_REQUEST",
      message: "Invalid preview request."
    });
  }

  if (fastifyError.code === "FST_ERR_CTP_BODY_TOO_LARGE" || fastifyError.statusCode === 413) {
    logSecurityEvent("worker-body-limit-exceeded", {
      requestId: request.id,
      path: request.url,
      method: request.method,
      ip: request.ip,
      bodyLimitBytes: env.WORKER_BODY_LIMIT_BYTES
    });

    if (request.url.startsWith("/internal/render/preview")) {
      return reply.code(413).send({
        ok: false,
        errorCode: "PAYLOAD_TOO_LARGE",
        message: "Preview payload too large."
      });
    }

    return reply.code(413).send({
      error: "Request payload too large.",
      requestId: request.id
    });
  }

  console.error(
    JSON.stringify({
      category: "operational",
      service: "worker",
      event: "unhandled-error",
      occurredAt: new Date().toISOString(),
      requestId: request.id,
      path: request.url,
      method: request.method,
      message: error instanceof Error ? error.message : "Unknown error"
    })
  );

  if (request.url.startsWith("/internal/render/preview")) {
    return reply.code(500).send({
      ok: false,
      errorCode: "INTERNAL_ERROR",
      message: "Preview service is temporarily unavailable."
    });
  }

  return reply.code(500).send({
    error: "Internal server error.",
    requestId: request.id
  });
});

await cleanupStaleRenderWorkspaces({
  tempRootDir: env.TYPST_TEMP_ROOT_DIR,
  maxAgeMs: env.TYPST_WORKSPACE_MAX_AGE_MS
});

await app.listen({
  host: "0.0.0.0",
  port: env.WORKER_PORT
});

logger.info(`Typ-Nique render worker started on port ${env.WORKER_PORT}.`);
