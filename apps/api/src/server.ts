import { buildApp } from "./app.js";
import { registerMultiplayerGateway } from "./gateways/multiplayer-gateway.js";
import { env } from "./lib/env.js";
import { prisma } from "./lib/prisma.js";
import { redisConnection } from "./lib/queue.js";
import { awaitApiStartupDependencies, createApiRuntimeState, refreshApiDependencyState } from "./lib/startup.js";

const runtimeState = createApiRuntimeState();
const app = buildApp({
  runtimeState,
  refreshReadiness: () => refreshApiDependencyState(runtimeState)
});
registerMultiplayerGateway(app);

redisConnection.on("ready", () => {
  runtimeState.checks.redis = "up";
  app.log.info({ dependency: "redis" }, "api-redis-ready");
});

redisConnection.on("error", (error) => {
  runtimeState.checks.redis = "down";
  app.log.error({ err: error, dependency: "redis" }, "api-redis-error");
});

redisConnection.on("end", () => {
  runtimeState.checks.redis = "down";

  if (!runtimeState.shuttingDown) {
    app.log.warn({ dependency: "redis" }, "api-redis-disconnected");
  }
});

const shutdownSignals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];

for (const signal of shutdownSignals) {
  process.on(signal, () => {
    if (runtimeState.shuttingDown) {
      return;
    }

    runtimeState.shuttingDown = true;
    runtimeState.ready = false;

    app.log.info({ signal }, "api-shutdown-signal");

    const forceCloseTimer = setTimeout(() => {
      app.log.error({ signal }, "api-shutdown-timeout");
      process.exit(1);
    }, 10_000);

    void Promise.allSettled([app.close(), prisma.$disconnect(), redisConnection.quit()]).then((results) => {
      clearTimeout(forceCloseTimer);

      const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");

      if (failures.length > 0) {
        app.log.error(
          {
            signal,
            failures: failures.map((failure) => String(failure.reason))
          },
          "api-shutdown-failed"
        );
        process.exit(1);
        return;
      }

      app.log.info({ signal }, "api-stopped");
      process.exit(0);
    });
  });
}

async function start() {
  app.log.info(
    {
      port: env.API_PORT,
      websocketPath: "/api/v1/multiplayer/ws",
      startupMaxAttempts: env.API_STARTUP_MAX_ATTEMPTS,
      startupRetryDelayMs: env.API_STARTUP_RETRY_DELAY_MS
    },
    "api-starting"
  );

  try {
    await awaitApiStartupDependencies(runtimeState, app.log);

    await app.listen({
      host: "0.0.0.0",
      port: env.API_PORT
    });

    runtimeState.ready = true;

    app.log.info(
      {
        port: env.API_PORT,
        checks: runtimeState.checks
      },
      "api-started"
    );
  } catch (error) {
    runtimeState.ready = false;
    app.log.error({ err: error, port: env.API_PORT }, "api-startup-failed");
    await Promise.allSettled([app.close(), prisma.$disconnect(), redisConnection.quit()]);
    process.exit(1);
  }
}

void start();
