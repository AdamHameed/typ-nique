import { parseServiceEnv } from "@typ-nique/validation";
import path from "node:path";
import { z } from "zod";

const optionalNumber = z.preprocess((value) => {
  if (value === "" || value === undefined || value === null) {
    return undefined;
  }

  return value;
}, z.coerce.number().optional());

const optionalBoolean = z.preprocess((value) => {
  if (value === "" || value === undefined || value === null) {
    return undefined;
  }

  return value;
}, z.union([z.literal("true"), z.literal("false")]).optional().transform((value) => {
  if (value === undefined) {
    return undefined;
  }

  return value === "true";
}));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional(),
  PORT: optionalNumber,
  WORKER_PORT: z.coerce.number().default(4100),
  WORKER_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(15000),
  WORKER_BODY_LIMIT_BYTES: z.coerce.number().int().min(1024).max(131072).default(16 * 1024),
  WORKER_STARTUP_CHECK_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(5000),
  WORKER_STARTUP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(60).default(12),
  WORKER_STARTUP_RETRY_DELAY_MS: z.coerce.number().int().min(250).max(30000).default(2000),
  WORKER_SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(10000),
  REDIS_URL: z.string().min(1),
  QUEUE_NAME: z.string().default("render-jobs"),
  WORKER_INTERNAL_TOKEN: z.string().min(1).optional(),
  RENDER_ADMIN_TOKEN: z.string().min(1).optional(),
  ENABLE_RENDER_ADMIN: optionalBoolean,
  TYPST_BIN: z.string().default("typst"),
  TYPST_TIMEOUT_MS: z.coerce.number().default(4000),
  TYPST_MAX_MEMORY_KB: z.coerce.number().default(524288),
  TYPST_MAX_CONCURRENT_RENDERS: z.coerce.number().int().min(1).max(16).default(2),
  TYPST_MAX_SOURCE_BYTES: z.coerce.number().default(12000),
  TYPST_MAX_OUTPUT_BYTES: z.coerce.number().default(262144),
  TYPST_MAX_LOG_BYTES: z.coerce.number().default(16384),
  TYPST_TEMP_ROOT_DIR: z
    .string()
    .optional()
    .refine((value) => value === undefined || path.isAbsolute(value), {
      message: "TYPST_TEMP_ROOT_DIR must be an absolute path when provided."
    }),
  TYPST_WORKSPACE_MAX_AGE_MS: z.coerce.number().default(900000),
  RENDER_CACHE_TTL_MS: z.coerce.number().default(300000),
  RENDER_FAILURE_CACHE_TTL_MS: z.coerce.number().default(30000),
  RENDER_CACHE_MAX_ENTRIES: z.coerce.number().int().min(10).max(5000).default(500)
});

const parsedEnv = parseServiceEnv("worker", envSchema, process.env);

if (parsedEnv.NODE_ENV === "production" && !parsedEnv.WORKER_INTERNAL_TOKEN) {
  throw new Error("WORKER_INTERNAL_TOKEN must be set in production.");
}

if (parsedEnv.ENABLE_RENDER_ADMIN && !parsedEnv.RENDER_ADMIN_TOKEN) {
  throw new Error("RENDER_ADMIN_TOKEN must be set when ENABLE_RENDER_ADMIN is true.");
}

if (
  parsedEnv.WORKER_INTERNAL_TOKEN &&
  parsedEnv.RENDER_ADMIN_TOKEN &&
  parsedEnv.WORKER_INTERNAL_TOKEN === parsedEnv.RENDER_ADMIN_TOKEN
) {
  throw new Error("RENDER_ADMIN_TOKEN must be different from WORKER_INTERNAL_TOKEN.");
}

export const env = {
  ...parsedEnv,
  LOG_LEVEL:
    parsedEnv.LOG_LEVEL ?? (parsedEnv.NODE_ENV === "development" ? "debug" : parsedEnv.NODE_ENV === "test" ? "error" : "info"),
  WORKER_PORT: parsedEnv.PORT ?? parsedEnv.WORKER_PORT,
  ENABLE_RENDER_ADMIN: parsedEnv.ENABLE_RENDER_ADMIN ?? false
};
