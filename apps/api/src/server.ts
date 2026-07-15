import type { Server } from "node:http";

import { getApiEnv } from "./config/env.js";
import { initializeRuntimeSecrets } from "./config/secrets.js";

let server: Server | undefined;

async function start(): Promise<void> {
  const env = getApiEnv();
  await initializeRuntimeSecrets(env);

  const { app } = await import("./app.js");

  server = app.listen(env.PORT, () => {
    console.log(`taxpulse-api listening on port ${env.PORT}`);
  });
}

function shutdown(signal: NodeJS.Signals): void {
  console.log(`received ${signal}; closing taxpulse-api`);

  if (!server) {
    process.exit(0);
  }

  server.close((error?: Error) => {
    if (error) {
      console.error("taxpulse-api shutdown failed", error);
      process.exit(1);
    }

    console.log("taxpulse-api closed");
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`taxpulse-api refused to boot: ${message}`);
  process.exit(1);
});
