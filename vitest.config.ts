import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";
import { ISOLATED_LOCAL_D1_TEST_TIMEOUT_MS } from "./test/helpers/isolated-local-d1-timeout";

const sharedConfig = {
  esbuild: {
    jsx: "automatic" as const,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
};

export default defineConfig({
  ...sharedConfig,
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
          exclude: [
            ...configDefaults.exclude,
            "test/**/*.integration.test.ts",
            "test/**/*.integration.test.tsx",
          ],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["test/**/*.integration.test.ts", "test/**/*.integration.test.tsx"],
          environment: "node",
          testTimeout: ISOLATED_LOCAL_D1_TEST_TIMEOUT_MS,
          hookTimeout: 45_000,
        },
      },
    ],
    reporters: process.env.CI ? ["default", "junit"] : ["default"],
    outputFile: process.env.CI ? { junit: "test-results/junit.xml" } : undefined,
  },
});
