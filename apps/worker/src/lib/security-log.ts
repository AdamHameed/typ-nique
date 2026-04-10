type SecurityLogLevel = "info" | "warn" | "error";

export function logSecurityEvent(
  event: string,
  payload: Record<string, unknown>,
  level: SecurityLogLevel = "warn"
) {
  const record = JSON.stringify({
    category: "security",
    service: "worker",
    event,
    occurredAt: new Date().toISOString(),
    ...payload
  });

  if (level === "error") {
    console.error(record);
    return;
  }

  if (level === "info") {
    console.info(record);
    return;
  }

  console.warn(record);
}
