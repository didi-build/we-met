import path from "node:path";
import { defineConfig } from "vitest/config";

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
          exclude: ["test/**/*.integration.test.ts", "test/**/*.integration.test.tsx"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["test/**/*.integration.test.ts", "test/**/*.integration.test.tsx"],
          environment: "node",
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
    ],
    reporters: process.env.CI ? ["default", "junit"] : ["default"],
    outputFile: process.env.CI ? { junit: "test-results/junit.xml" } : undefined,
  },
});
