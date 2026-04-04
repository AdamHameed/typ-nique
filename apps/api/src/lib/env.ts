import "dotenv/config";
import { z } from "zod";

const optionalString = z.preprocess((value) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}, z.string().min(1).optional());

const optionalNumber = z.preprocess((value) => {
  if (value === "" || value === undefined || value === null) {
    return undefined;
  }

  return value;
}, z.coerce.number().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: optionalNumber,
  API_PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  WORKER_RENDER_URL: z.string().url().default("http://127.0.0.1:4100"),
  WORKER_INTERNAL_TOKEN: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1),
  QUEUE_NAME: z.string().default("render-jobs"),
  AUTH_COOKIE_NAME: z.string().default("typ_nique_auth"),
  GUEST_COOKIE_NAME: z.string().default("typ_nique_guest"),
  AUTH_COOKIE_DOMAIN: optionalString,
  AUTH_COOKIE_SECURE: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((value) => value === "true"),
  AUTH_SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  PREVIEW_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
  PREVIEW_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(45),
  SUBMISSION_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
  SUBMISSION_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(90)
});

const parsedEnv = envSchema.parse(process.env);

export const env = {
  ...parsedEnv,
  API_PORT: parsedEnv.PORT ?? parsedEnv.API_PORT,
  AUTH_COOKIE_SECURE: parsedEnv.AUTH_COOKIE_SECURE ?? parsedEnv.NODE_ENV === "production"
};
