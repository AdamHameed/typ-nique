import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { env } from "./env.js";

export const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null
});

export function createQueueWorker(processor: ConstructorParameters<typeof Worker>[1]) {
  return new Worker(env.QUEUE_NAME, processor, {
    connection: redisConnection,
    concurrency: 2
  });
}
