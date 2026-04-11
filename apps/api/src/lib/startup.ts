import type { FastifyBaseLogger } from "fastify";
import { prisma } from "./prisma.js";
import { redisConnection } from "./queue.js";
import { env } from "./env.js";

type DependencyStatus = "up" | "down";

export interface ApiRuntimeState {
  startedAt: string;
  shuttingDown: boolean;
  ready: boolean;
  lastDependencyCheckAt: string | null;
  checks: {
    database: DependencyStatus;
    redis: DependencyStatus;
  };
}

export function createApiRuntimeState(): ApiRuntimeState {
  return {
    startedAt: new Date().toISOString(),
    shuttingDown: false,
    ready: false,
    lastDependencyCheckAt: null,
    checks: {
      database: "down",
      redis: "down"
    }
  };
}

export async function refreshApiDependencyState(runtimeState: ApiRuntimeState) {
  const checks = {
    database: "down" as DependencyStatus,
    redis: "down" as DependencyStatus
  };

  try {
    await pingDatabase();
    checks.database = "up";
  } catch {
    // Keep the down state for the health response.
  }

  try {
    await pingRedis();
    checks.redis = "up";
  } catch {
    // Keep the down state for the health response.
  }

  runtimeState.checks = checks;
  runtimeState.lastDependencyCheckAt = new Date().toISOString();

  return checks.database === "up" && checks.redis === "up";
}

export async function awaitApiStartupDependencies(runtimeState: ApiRuntimeState, logger: FastifyBaseLogger) {
  await retryStartupDependency("database", pingDatabase, logger);
  runtimeState.checks.database = "up";

  await retryStartupDependency("redis", pingRedis, logger);
  runtimeState.checks.redis = "up";
  runtimeState.lastDependencyCheckAt = new Date().toISOString();
}

async function retryStartupDependency(name: "database" | "redis", check: () => Promise<void>, logger: FastifyBaseLogger) {
  for (let attempt = 1; attempt <= env.API_STARTUP_MAX_ATTEMPTS; attempt += 1) {
    try {
      await check();
      logger.info({ dependency: name, attempt, maxAttempts: env.API_STARTUP_MAX_ATTEMPTS }, "api-startup-check-passed");
      return;
    } catch (error) {
      const context = {
        dependency: name,
        attempt,
        maxAttempts: env.API_STARTUP_MAX_ATTEMPTS,
        retryDelayMs: env.API_STARTUP_RETRY_DELAY_MS,
        err: error
      };

      if (attempt >= env.API_STARTUP_MAX_ATTEMPTS) {
        logger.error(context, "api-startup-check-failed");
        throw error;
      }

      logger.warn(context, "api-startup-check-retrying");
      await sleep(env.API_STARTUP_RETRY_DELAY_MS);
    }
  }
}

async function pingDatabase() {
  await withTimeout(prisma.$queryRaw`SELECT 1`, env.API_STARTUP_CHECK_TIMEOUT_MS, "Database readiness check timed out.");
}

async function pingRedis() {
  const response = await withTimeout(redisConnection.ping(), env.API_STARTUP_CHECK_TIMEOUT_MS, "Redis readiness check timed out.");

  if (response !== "PONG") {
    throw new Error(`Unexpected Redis ping response: ${response}`);
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(message));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
