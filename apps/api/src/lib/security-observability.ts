import { apiLogger, sanitizeLogMetadata } from "./logger.js";

type SecurityLogLevel = "info" | "warn" | "error";

export function logSecurityEvent(
  event: string,
  payload: Record<string, unknown>,
  level: SecurityLogLevel = "warn"
) {
  apiLogger[level](
    sanitizeLogMetadata({
      category: "security",
      event,
      occurredAt: new Date().toISOString(),
      ...payload
    }),
    event
  );
}

export function sanitizeMultiplayerClientError(message: string) {
  if (
    message === "Room not accessible." ||
    message === "Player has already left this room." ||
    message === "No room subscription is active." ||
    message === "Room version conflict."
  ) {
    return message;
  }

  if (message === "Only the room host can start the countdown.") {
    return message;
  }

  if (message === "All joined players must be ready before the race can start.") {
    return message;
  }

  if (message === "At least two active players are required to start.") {
    return message;
  }

  if (message === "Round not accessible.") {
    return "Action not allowed for this race room.";
  }

  return "Live room action rejected.";
}
