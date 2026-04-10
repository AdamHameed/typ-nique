import Fastify from "fastify";
import helmet from "@fastify/helmet";
import { adminRoutes } from "./routes/admin-routes.js";
import { previewRoutes } from "./routes/preview-routes.js";
import { env } from "./lib/env.js";
import { createQueueWorker } from "./lib/queue.js";
import { logger } from "./lib/logger.js";
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
  bodyLimit: 16 * 1024,
  logger: false
});

await app.register(helmet);
await app.register(previewRoutes);

if (env.ENABLE_RENDER_ADMIN && env.RENDER_ADMIN_TOKEN) {
  await app.register(adminRoutes);
}

app.get("/health", async () => ({ ok: true }));

await cleanupStaleRenderWorkspaces({
  tempRootDir: env.TYPST_TEMP_ROOT_DIR,
  maxAgeMs: env.TYPST_WORKSPACE_MAX_AGE_MS
});

await app.listen({
  host: "0.0.0.0",
  port: env.WORKER_PORT
});

logger.info(`Typ-Nique render worker started on port ${env.WORKER_PORT}.`);
