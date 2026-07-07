import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/typescript/stage-transition.ts"],
      provider: "v8",
      reporter: ["text"],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80
      }
    },
    globals: true,
    passWithNoTests: true
  }
});
