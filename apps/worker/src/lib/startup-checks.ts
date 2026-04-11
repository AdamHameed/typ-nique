import type { Logger } from "pino";
import { spawn } from "node:child_process";
import { cleanupRenderWorkspace, createRenderWorkspace } from "../renderer/temp-workspace.js";
import { env } from "./env.js";
import { redisConnection } from "./queue.js";

export interface WorkerStartupCheckStatus {
  redis: "up" | "down";
  typst: "up" | "down";
  tempStorage: "up" | "down";
}

export interface WorkerStartupCheckResult {
  checks: WorkerStartupCheckStatus;
  metadata: {
    typstVersion: string | null;
    checkedAt: string;
  };
}

export async function runWorkerStartupChecks(): Promise<WorkerStartupCheckResult> {
  const typstVersion = await verifyTypstBinary();
  await verifyRedisConnection();
  await verifyTempStorage();

  return {
    checks: {
      redis: "up",
      typst: "up",
      tempStorage: "up"
    },
    metadata: {
      typstVersion,
      checkedAt: new Date().toISOString()
    }
  };
}

export async function runWorkerStartupChecksWithRetry(logger: Pick<Logger, "info" | "warn" | "error">) {
  for (let attempt = 1; attempt <= env.WORKER_STARTUP_MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await runWorkerStartupChecks();
      logger.info(
        {
          category: "startup",
          event: "worker-startup-check-passed",
          attempt,
          maxAttempts: env.WORKER_STARTUP_MAX_ATTEMPTS,
          checks: result.checks
        },
        "worker-startup-check-passed"
      );
      return result;
    } catch (error) {
      const context = {
        category: "startup",
        event: attempt >= env.WORKER_STARTUP_MAX_ATTEMPTS ? "worker-startup-check-failed" : "worker-startup-check-retrying",
        attempt,
        maxAttempts: env.WORKER_STARTUP_MAX_ATTEMPTS,
        retryDelayMs: env.WORKER_STARTUP_RETRY_DELAY_MS,
        err: error
      };

      if (attempt >= env.WORKER_STARTUP_MAX_ATTEMPTS) {
        logger.error(context, "worker-startup-check-failed");
        throw error;
      }

      logger.warn(context, "worker-startup-check-retrying");
      await sleep(env.WORKER_STARTUP_RETRY_DELAY_MS);
    }
  }

  throw new Error("Worker startup checks exhausted without returning a result.");
}

async function verifyRedisConnection() {
  const response = await withTimeout(redisConnection.ping(), env.WORKER_STARTUP_CHECK_TIMEOUT_MS, "Redis ping timed out.");

  if (response !== "PONG") {
    throw new Error(`Unexpected Redis ping response: ${response}`);
  }
}

async function verifyTempStorage() {
  const workspace = await withTimeout(
    createRenderWorkspace(env.TYPST_TEMP_ROOT_DIR),
    env.WORKER_STARTUP_CHECK_TIMEOUT_MS,
    "Temp workspace creation timed out."
  );

  await cleanupRenderWorkspace(workspace);
}

async function verifyTypstBinary() {
  return new Promise<string>((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    const child = spawn(env.TYPST_BIN, ["--version"], {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME
      }
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Typst version check timed out after ${env.WORKER_STARTUP_CHECK_TIMEOUT_MS}ms.`));
    }, env.WORKER_STARTUP_CHECK_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (exitCode) => {
      clearTimeout(timer);

      if (exitCode !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `Typst exited with code ${exitCode ?? "unknown"}.`));
        return;
      }

      resolve(stdout.trim() || "typst");
    });
  });
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
