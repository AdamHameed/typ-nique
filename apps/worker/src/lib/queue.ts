import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { env } from "./env.js";

export const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  connectTimeout: env.WORKER_STARTUP_CHECK_TIMEOUT_MS,
  retryStrategy(attempt) {
    return Math.min(attempt * 200, 2_000);
  }
});

export function createQueueWorker(processor: ConstructorParameters<typeof Worker>[1]) {
  return new Worker(env.QUEUE_NAME, processor, {
    connection: redisConnection,
    concurrency: env.TYPST_MAX_CONCURRENT_RENDERS
  });
}
