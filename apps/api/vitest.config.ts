import { defineConfig } from "vitest/config";

export default defineConfig({
  root: import.meta.dirname,
  test: {
    fileParallelism: false,
    globalSetup: ["./test/setup/postgres-container.ts"],
    hookTimeout: 120_000,
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test/setup/db-cleanup.ts"],
    testTimeout: 60_000
  }
});
