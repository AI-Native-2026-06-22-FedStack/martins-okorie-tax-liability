import type { Server } from "node:http";

import { getApiEnv } from "./config/env.js";
import { initializeRuntimeSecrets } from "./config/secrets.js";
import { closeDefaultDb } from "./db/client.js";

let server: Server | undefined;
let shutdownStarted = false;

async function start(): Promise<void> {
  const env = getApiEnv();
  await initializeRuntimeSecrets(env);

  const { app } = await import("./app.js");

  server = app.listen(env.PORT, () => {
    console.log(`taxpulse-api listening on port ${env.PORT}`);
  });
}

function closeHttpServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server) {
      resolve();
      return;
    }

    server.close((error?: Error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shutdownStarted) {
    return;
  }

  shutdownStarted = true;
  console.log(`received ${signal}; closing taxpulse-api`);

  try {
    await closeHttpServer();
    await closeDefaultDb();

    console.log("taxpulse-api closed");
    process.exit(0);
  } catch (error) {
    console.error("taxpulse-api shutdown failed", error);
    process.exit(1);
  }
}

process.on("SIGINT", (signal) => {
  void shutdown(signal);
});
process.on("SIGTERM", (signal) => {
  void shutdown(signal);
});

start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`taxpulse-api refused to boot: ${message}`);
  process.exit(1);
});
