import { logger, sanitizeLogMetadata } from "./logger.js";

type SecurityLogLevel = "info" | "warn" | "error";

export function logSecurityEvent(
  event: string,
  payload: Record<string, unknown>,
  level: SecurityLogLevel = "warn"
) {
  logger[level](
    sanitizeLogMetadata({
      category: "security",
      service: "worker",
      event,
      occurredAt: new Date().toISOString(),
      ...payload
    }),
    event
  );
}
