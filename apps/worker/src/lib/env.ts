import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  WORKER_PORT: z.coerce.number().default(4100),
  REDIS_URL: z.string().min(1),
  QUEUE_NAME: z.string().default("render-jobs"),
  TYPST_BIN: z.string().default("typst"),
  TYPST_TIMEOUT_MS: z.coerce.number().default(4000),
  TYPST_MAX_SOURCE_BYTES: z.coerce.number().default(12000),
  TYPST_MAX_OUTPUT_BYTES: z.coerce.number().default(262144),
  TYPST_MAX_LOG_BYTES: z.coerce.number().default(16384),
  TYPST_TEMP_ROOT_DIR: z.string().optional(),
  RENDER_CACHE_TTL_MS: z.coerce.number().default(300000),
  RENDER_FAILURE_CACHE_TTL_MS: z.coerce.number().default(30000)
});

export const env = envSchema.parse(process.env);
