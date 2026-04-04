import Fastify from "fastify";
import cors from "@fastify/cors";
import { previewRoutes } from "./routes/preview-routes.js";
import { env } from "./lib/env.js";
import { createQueueWorker } from "./lib/queue.js";
import { logger } from "./lib/logger.js";
import { handleRenderCheckJob } from "./jobs/render-check-job.js";

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
  logger: false
});

await app.register(cors, { origin: true });
await app.register(previewRoutes);

app.get("/health", async () => ({ ok: true }));

await app.listen({
  host: "0.0.0.0",
  port: env.WORKER_PORT
});

logger.info(`Typ-Nique render worker started on port ${env.WORKER_PORT}.`);
