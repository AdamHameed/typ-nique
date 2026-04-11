import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "./env.js";

export const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  connectTimeout: env.API_STARTUP_CHECK_TIMEOUT_MS,
  retryStrategy(attempt) {
    return Math.min(attempt * 200, 2_000);
  }
});

export const renderQueue = new Queue(env.QUEUE_NAME, {
  connection: redisConnection
});
