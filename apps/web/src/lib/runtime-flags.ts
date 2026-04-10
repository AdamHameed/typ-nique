const isProduction = process.env.NODE_ENV === "production";

export const multiplayerDiagnosticsEnabled =
  process.env.NEXT_PUBLIC_ENABLE_MULTIPLAYER_DIAGNOSTICS === "true" || !isProduction;
