import { app } from "./app.js";

const port = Number(process.env.PORT ?? 3000);

const server = app.listen(port, () => {
  console.log(`taxpulse-api listening on port ${port}`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`received ${signal}; closing taxpulse-api`);

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
