import { z } from "zod";
import { parseAllowedBrowserOrigins } from "./browser-origin.js";

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

const optionalUrl = z.preprocess((value) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}, z.string().url().optional());

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
  PORT: optionalNumber,
  API_PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  WORKER_RENDER_URL: optionalUrl,
  WORKER_INTERNAL_TOKEN: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1),
  QUEUE_NAME: z.string().default("render-jobs"),
  AUTH_COOKIE_NAME: z.string().default("typ_nique_auth"),
  GUEST_COOKIE_NAME: z.string().default("typ_nique_guest"),
  AUTH_COOKIE_DOMAIN: optionalString,
  AUTH_COOKIE_SECURE: optionalBoolean,
  TRUST_PROXY: optionalBoolean,
  ALLOWED_BROWSER_ORIGINS: optionalString,
  ENABLE_MULTIPLAYER_DIAGNOSTICS: optionalBoolean,
  AUTH_SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  PREVIEW_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
  PREVIEW_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(45),
  SUBMISSION_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
  SUBMISSION_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(90)
});

const parsedEnv = envSchema.parse(process.env);
const defaultWorkerRenderUrl = parsedEnv.NODE_ENV === "production" ? undefined : "http://127.0.0.1:4100";
const workerRenderUrl = parsedEnv.WORKER_RENDER_URL ?? defaultWorkerRenderUrl;
const authCookieSecure = parsedEnv.AUTH_COOKIE_SECURE ?? parsedEnv.NODE_ENV === "production";
const allowedBrowserOrigins =
  parsedEnv.ALLOWED_BROWSER_ORIGINS
    ? parseAllowedBrowserOrigins(parsedEnv.ALLOWED_BROWSER_ORIGINS)
    : parsedEnv.NODE_ENV === "production"
      ? []
      : ["http://localhost:3000", "http://127.0.0.1:3000"];

if (!workerRenderUrl) {
  throw new Error("WORKER_RENDER_URL must be set in production.");
}

if (parsedEnv.NODE_ENV === "production" && !parsedEnv.WORKER_INTERNAL_TOKEN) {
  throw new Error("WORKER_INTERNAL_TOKEN must be set in production.");
}

if (parsedEnv.NODE_ENV === "production" && !authCookieSecure) {
  throw new Error("AUTH_COOKIE_SECURE must be true in production.");
}

export const env = {
  ...parsedEnv,
  API_PORT: parsedEnv.PORT ?? parsedEnv.API_PORT,
  WORKER_RENDER_URL: workerRenderUrl,
  AUTH_COOKIE_SECURE: authCookieSecure,
  TRUST_PROXY: parsedEnv.TRUST_PROXY ?? parsedEnv.NODE_ENV === "production",
  ALLOWED_BROWSER_ORIGINS: allowedBrowserOrigins,
  ENABLE_MULTIPLAYER_DIAGNOSTICS: parsedEnv.ENABLE_MULTIPLAYER_DIAGNOSTICS ?? parsedEnv.NODE_ENV !== "production"
};
