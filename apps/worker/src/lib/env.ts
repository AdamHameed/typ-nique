import "dotenv/config";
import { z } from "zod";

const optionalNumber = z.preprocess((value) => {
  if (value === "" || value === undefined || value === null) {
    return undefined;
  }

  return value;
}, z.coerce.number().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: optionalNumber,
  WORKER_PORT: z.coerce.number().default(4100),
  REDIS_URL: z.string().min(1),
  QUEUE_NAME: z.string().default("render-jobs"),
  WORKER_INTERNAL_TOKEN: z.string().min(1).optional(),
  RENDER_ADMIN_TOKEN: z.string().min(1).optional(),
  TYPST_BIN: z.string().default("typst"),
  TYPST_TIMEOUT_MS: z.coerce.number().default(4000),
  TYPST_MAX_MEMORY_KB: z.coerce.number().default(524288),
  TYPST_MAX_CONCURRENT_RENDERS: z.coerce.number().int().min(1).max(16).default(2),
  TYPST_MAX_SOURCE_BYTES: z.coerce.number().default(12000),
  TYPST_MAX_OUTPUT_BYTES: z.coerce.number().default(262144),
  TYPST_MAX_LOG_BYTES: z.coerce.number().default(16384),
  TYPST_TEMP_ROOT_DIR: z.string().optional(),
  TYPST_WORKSPACE_MAX_AGE_MS: z.coerce.number().default(900000),
  RENDER_CACHE_TTL_MS: z.coerce.number().default(300000),
  RENDER_FAILURE_CACHE_TTL_MS: z.coerce.number().default(30000),
  RENDER_CACHE_MAX_ENTRIES: z.coerce.number().int().min(10).max(5000).default(500)
});

const parsedEnv = envSchema.parse(process.env);

export const env = {
  ...parsedEnv,
  WORKER_PORT: parsedEnv.PORT ?? parsedEnv.WORKER_PORT
};
