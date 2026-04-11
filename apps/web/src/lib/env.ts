import { parseServiceEnv } from "@typ-nique/validation";
import { z } from "zod";

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

const publicEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_API_URL: optionalUrl,
  NEXT_PUBLIC_MULTIPLAYER_GATEWAY_URL: optionalUrl,
  NEXT_PUBLIC_ENABLE_MULTIPLAYER_DIAGNOSTICS: optionalBoolean
});

const serverEnvSchema = publicEnvSchema.extend({
  API_INTERNAL_URL: optionalUrl
});

const parsedPublicEnv = parseServiceEnv("web-public", publicEnvSchema, process.env);
const isProduction = parsedPublicEnv.NODE_ENV === "production";
const publicApiUrl = parsedPublicEnv.NEXT_PUBLIC_API_URL ?? (isProduction ? undefined : "http://localhost:4000");

export const publicEnv = {
  ...parsedPublicEnv,
  NEXT_PUBLIC_API_URL: publicApiUrl,
  NEXT_PUBLIC_ENABLE_MULTIPLAYER_DIAGNOSTICS:
    parsedPublicEnv.NEXT_PUBLIC_ENABLE_MULTIPLAYER_DIAGNOSTICS ?? !isProduction
};

let cachedServerEnv: (typeof publicEnv & { API_INTERNAL_URL: string | undefined }) | null = null;

function normalizeLoopbackUrl(url: string | undefined) {
  return url?.replace("://localhost", "://127.0.0.1");
}

export function resolveServerApiOrigin() {
  const parsedServerEnv = parseServiceEnv("web-server", serverEnvSchema, process.env);
  const internalApiUrl =
    parsedServerEnv.API_INTERNAL_URL ?? normalizeLoopbackUrl(publicEnv.NEXT_PUBLIC_API_URL) ?? (isProduction ? undefined : "http://127.0.0.1:4000");

  if (isProduction && !internalApiUrl) {
    throw new Error("API_INTERNAL_URL or NEXT_PUBLIC_API_URL must be set in production.");
  }

  return internalApiUrl;
}

export function getServerEnv() {
  if (cachedServerEnv) {
    return cachedServerEnv;
  }

  cachedServerEnv = {
    ...publicEnv,
    API_INTERNAL_URL: resolveServerApiOrigin()
  };

  return cachedServerEnv;
}

export { isProduction };
