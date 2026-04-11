import Fastify from "fastify";
import helmet from "@fastify/helmet";
import type { Job } from "bullmq";
import { ZodError } from "zod";
import { adminRoutes } from "./routes/admin-routes.js";
import { previewRoutes } from "./routes/preview-routes.js";
import { env } from "./lib/env.js";
import { createQueueWorker, redisConnection } from "./lib/queue.js";
import { logger } from "./lib/logger.js";
import { logSecurityEvent } from "./lib/security-log.js";
import { runWorkerStartupChecksWithRetry } from "./lib/startup-checks.js";
import { handleRenderCheckJob } from "./jobs/render-check-job.js";
import { cleanupStaleRenderWorkspaces } from "./renderer/temp-workspace.js";

const app = Fastify({
  bodyLimit: env.WORKER_BODY_LIMIT_BYTES,
  requestTimeout: env.WORKER_REQUEST_TIMEOUT_MS,
  requestIdHeader: "x-request-id",
  logger: false
});

const runtimeState = {
  startedAt: new Date().toISOString(),
  shuttingDown: false,
  ready: false,
  lastDependencyCheckAt: null as string | null,
  checks: {
    redis: "down" as "up" | "down",
    typst: "down" as "up" | "down",
    tempStorage: "down" as "up" | "down"
  },
  typstVersion: null as string | null
};

await app.register(helmet);
await app.register(previewRoutes);

if (env.ENABLE_RENDER_ADMIN && env.RENDER_ADMIN_TOKEN) {
  await app.register(adminRoutes);
}

app.get("/health", async (_request, reply) => {
  reply.header("Cache-Control", "no-store");
  const ok = runtimeState.ready && !runtimeState.shuttingDown;

  return reply.code(ok ? 200 : 503).send({
    ok,
    ready: runtimeState.ready,
    shuttingDown: runtimeState.shuttingDown,
    startedAt: runtimeState.startedAt,
    lastDependencyCheckAt: runtimeState.lastDependencyCheckAt,
    checks: runtimeState.checks
  });
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

  logger.error(
    {
      category: "operational",
      event: "worker-unhandled-error",
      requestId: request.id,
      path: request.url,
      method: request.method,
      ip: request.ip,
      err: error
    },
    "worker-unhandled-error"
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

redisConnection.on("ready", () => {
  runtimeState.checks.redis = "up";
  logger.info({ category: "operational", event: "worker-redis-ready" }, "worker-redis-ready");
});

redisConnection.on("error", (error) => {
  runtimeState.checks.redis = "down";
  logger.error({ category: "operational", event: "worker-redis-error", err: error }, "worker-redis-error");
});

redisConnection.on("end", () => {
  runtimeState.checks.redis = "down";

  if (!runtimeState.shuttingDown) {
    logger.warn({ category: "operational", event: "worker-redis-disconnected" }, "worker-redis-disconnected");
  }
});

const worker = createQueueWorker(async (job) => {
  const context = getJobContext(job);

  logger.debug(
    {
      category: "operational",
      event: "render-job-started",
      ...context
    },
    "render-job-started"
  );

  return handleRenderCheckJob(job.data);
});

worker.on("completed", (job) => {
  logger.debug(
    {
      category: "operational",
      event: "render-job-completed",
      ...getJobContext(job)
    },
    "render-job-completed"
  );
});

worker.on("failed", (job, error) => {
  const attemptsConfigured = job?.opts.attempts ?? 1;
  const attemptsMade = job?.attemptsMade ?? 0;
  const hasRetryRemaining = attemptsMade < attemptsConfigured;
  const level = hasRetryRemaining ? "warn" : "error";

  logger[level](
    {
      category: "operational",
      event: hasRetryRemaining ? "render-job-failed-retrying" : "render-job-failed",
      ...getJobContext(job),
      attemptsMade,
      attemptsConfigured,
      err: error
    },
    hasRetryRemaining ? "render-job-failed-retrying" : "render-job-failed"
  );
});

worker.on("error", (error) => {
  logger.error({ category: "operational", event: "worker-queue-error", err: error }, "worker-queue-error");
});

worker.on("stalled", (jobId) => {
  logger.warn({ category: "operational", event: "render-job-stalled", jobId }, "render-job-stalled");
});

process.on("unhandledRejection", (reason) => {
  logger.error(
    {
      category: "operational",
      event: "worker-unhandled-rejection",
      err: reason instanceof Error ? reason : undefined,
      reason: reason instanceof Error ? reason.message : String(reason)
    },
    "worker-unhandled-rejection"
  );
});

process.on("uncaughtException", (error) => {
  logger.fatal({ category: "operational", event: "worker-uncaught-exception", err: error }, "worker-uncaught-exception");
  process.exit(1);
});

try {
  logger.info(
    {
      category: "startup",
      event: "worker-starting",
      port: env.WORKER_PORT,
      queueName: env.QUEUE_NAME,
      renderConcurrency: env.TYPST_MAX_CONCURRENT_RENDERS,
      startupMaxAttempts: env.WORKER_STARTUP_MAX_ATTEMPTS,
      startupRetryDelayMs: env.WORKER_STARTUP_RETRY_DELAY_MS
    },
    "worker-starting"
  );

  await cleanupStaleRenderWorkspaces({
    tempRootDir: env.TYPST_TEMP_ROOT_DIR,
    maxAgeMs: env.TYPST_WORKSPACE_MAX_AGE_MS
  });

  const startupChecks = await runWorkerStartupChecksWithRetry(logger);
  runtimeState.checks = startupChecks.checks;
  runtimeState.lastDependencyCheckAt = startupChecks.metadata.checkedAt;
  runtimeState.typstVersion = startupChecks.metadata.typstVersion;

  logger.info(
    {
      category: "startup",
      event: "worker-startup-checks-passed",
      checks: startupChecks.checks,
      typstVersion: startupChecks.metadata.typstVersion
    },
    "worker-startup-checks-passed"
  );

  await app.listen({
    host: "0.0.0.0",
    port: env.WORKER_PORT
  });
  runtimeState.ready = true;

  logger.info(
    {
      category: "startup",
      event: "worker-started",
      port: env.WORKER_PORT,
      checks: runtimeState.checks
    },
    "worker-started"
  );
} catch (error) {
  runtimeState.ready = false;
  logger.fatal({ category: "startup", event: "worker-startup-failed", err: error }, "worker-startup-failed");

  await Promise.allSettled([worker.close(), redisConnection.quit(), app.close()]);
  process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (runtimeState.shuttingDown) {
      return;
    }

    runtimeState.shuttingDown = true;
    runtimeState.ready = false;

    logger.info({ category: "shutdown", event: "worker-shutdown-signal", signal }, "worker-shutdown-signal");

    const forceCloseTimer = setTimeout(() => {
      logger.error({ category: "shutdown", event: "worker-shutdown-timeout", signal }, "worker-shutdown-timeout");
      process.exit(1);
    }, env.WORKER_SHUTDOWN_TIMEOUT_MS);

    void Promise.allSettled([worker.close(), app.close(), redisConnection.quit()]).then((results) => {
      clearTimeout(forceCloseTimer);

      const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");

      if (failures.length > 0) {
        logger.error(
          {
            category: "shutdown",
            event: "worker-shutdown-failed",
            signal,
            failures: failures.map((failure) => String(failure.reason))
          },
          "worker-shutdown-failed"
        );
        process.exit(1);
        return;
      }

      logger.info({ category: "shutdown", event: "worker-stopped", signal }, "worker-stopped");
      process.exit(0);
    });
  });
}

function getJobContext(job: Job | null | undefined) {
  const roundId =
    typeof job?.data === "object" && job.data !== null && "roundId" in job.data ? String(job.data.roundId) : "unknown";

  return {
    jobId: job?.id ?? null,
    jobName: job?.name ?? "unknown",
    roundId
  };
}
