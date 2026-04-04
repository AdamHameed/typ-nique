import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  WORKER_RENDER_URL: z.string().url().default("http://127.0.0.1:4100"),
  REDIS_URL: z.string().min(1),
  QUEUE_NAME: z.string().default("render-jobs"),
  AUTH_COOKIE_NAME: z.string().default("typ_nique_auth"),
  GUEST_COOKIE_NAME: z.string().default("typ_nique_guest"),
  AUTH_SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30)
});

export const env = envSchema.parse(process.env);
