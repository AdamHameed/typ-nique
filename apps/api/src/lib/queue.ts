import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "./env.js";

const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null
});

export const renderQueue = new Queue(env.QUEUE_NAME, {
  connection: redisConnection
});
