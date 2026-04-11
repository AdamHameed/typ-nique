import { parseServiceEnv } from "@typ-nique/validation";
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
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional(),
  PORT: optionalNumber,
  API_PORT: z.coerce.number().default(4000),
  API_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(15000),
  API_BODY_LIMIT_BYTES: z.coerce.number().int().min(1024).max(131072).default(16 * 1024),
  API_STARTUP_CHECK_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(5000),
  API_STARTUP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(60).default(12),
  API_STARTUP_RETRY_DELAY_MS: z.coerce.number().int().min(250).max(30000).default(2000),
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
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
  LEADERBOARD_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
  LEADERBOARD_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(120),
  MULTIPLAYER_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
  MULTIPLAYER_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(90),
  MULTIPLAYER_WS_CONNECTION_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
  MULTIPLAYER_WS_CONNECTION_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(24),
  MULTIPLAYER_WS_MESSAGE_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(10000),
  MULTIPLAYER_WS_MESSAGE_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(60),
  WEBSOCKET_MAX_PAYLOAD_BYTES: z.coerce.number().int().min(512).max(65536).default(4096),
  PREVIEW_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
  PREVIEW_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(45),
  SUBMISSION_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
  SUBMISSION_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(90)
});

const parsedEnv = parseServiceEnv("api", envSchema, process.env);
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

if (parsedEnv.NODE_ENV === "production" && allowedBrowserOrigins.length === 0) {
  throw new Error("ALLOWED_BROWSER_ORIGINS must be set in production.");
}

if (parsedEnv.NODE_ENV === "production" && !authCookieSecure) {
  throw new Error("AUTH_COOKIE_SECURE must be true in production.");
}

if (parsedEnv.AUTH_COOKIE_NAME === parsedEnv.GUEST_COOKIE_NAME) {
  throw new Error("AUTH_COOKIE_NAME and GUEST_COOKIE_NAME must be different.");
}

export const env = {
  ...parsedEnv,
  LOG_LEVEL:
    parsedEnv.LOG_LEVEL ?? (parsedEnv.NODE_ENV === "development" ? "debug" : parsedEnv.NODE_ENV === "test" ? "error" : "info"),
  API_PORT: parsedEnv.PORT ?? parsedEnv.API_PORT,
  WORKER_RENDER_URL: workerRenderUrl,
  AUTH_COOKIE_SECURE: authCookieSecure,
  TRUST_PROXY: parsedEnv.TRUST_PROXY ?? parsedEnv.NODE_ENV === "production",
  ALLOWED_BROWSER_ORIGINS: allowedBrowserOrigins,
  ENABLE_MULTIPLAYER_DIAGNOSTICS: parsedEnv.ENABLE_MULTIPLAYER_DIAGNOSTICS ?? parsedEnv.NODE_ENV !== "production"
};
