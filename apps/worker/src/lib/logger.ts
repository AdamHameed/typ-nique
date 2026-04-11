import pino from "pino";
import { env } from "./env.js";

type JsonLike =
  | null
  | boolean
  | number
  | string
  | JsonLike[]
  | { [key: string]: JsonLike };

const SENSITIVE_KEY_PATTERN = /(authorization|cookie|password|secret|token|api[-_]?key|set-cookie)/i;

export const logger = pino({
  level: env.LOG_LEVEL || (env.NODE_ENV === "development" ? "debug" : env.NODE_ENV === "test" ? "error" : "info"),
  base: {
    service: "worker",
    nodeEnv: env.NODE_ENV
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "headers.cookie",
      "headers.authorization",
      "headers[\"x-worker-internal-token\"]",
      "headers[\"x-render-admin-token\"]",
      "password",
      "token",
      "secret"
    ],
    censor: "[Redacted]"
  }
});

export function sanitizeLogMetadata<T>(value: T): T {
  return sanitize(value) as T;
}

function sanitize(value: unknown): JsonLike {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return value.length > 2_000 ? `${value.slice(0, 2_000)}...[truncated]` : value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitize(entry));
  }

  if (!value || typeof value !== "object" || value instanceof Error || Buffer.isBuffer(value)) {
    return String(value);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? "[Redacted]" : sanitize(entry)
    ])
  );
}
