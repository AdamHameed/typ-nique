function normalizeOrigin(origin: string) {
  return new URL(origin).origin;
}

export function parseAllowedBrowserOrigins(rawValue?: string) {
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map(normalizeOrigin);
}

export function isAllowedBrowserOrigin(origin: string | undefined, allowedOrigins: string[]) {
  if (!origin) {
    return true;
  }

  try {
    return allowedOrigins.includes(normalizeOrigin(origin));
  } catch {
    return false;
  }
}
