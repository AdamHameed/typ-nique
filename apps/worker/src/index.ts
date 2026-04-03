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

logger.info("Typ-Nique render worker started.");
