import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: [
        "apps/api/src/modeling/store-figures.ts",
        "apps/api/src/engine/calc-client.ts",
        "src/typescript/stage-transition.ts",
      ],
      provider: "v8",
      reporter: ["text"],
      thresholds: {
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
    globals: true,
    passWithNoTests: true,
  },
});
