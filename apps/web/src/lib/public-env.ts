const isProduction = process.env.NODE_ENV === "production";

export const publicEnv = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? (isProduction ? undefined : "http://localhost:4000"),
  NEXT_PUBLIC_MULTIPLAYER_GATEWAY_URL: process.env.NEXT_PUBLIC_MULTIPLAYER_GATEWAY_URL,
  NEXT_PUBLIC_ENABLE_MULTIPLAYER_DIAGNOSTICS:
    process.env.NEXT_PUBLIC_ENABLE_MULTIPLAYER_DIAGNOSTICS === "true" || !isProduction
} as const;

export { isProduction };
