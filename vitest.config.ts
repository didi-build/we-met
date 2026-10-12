import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: [
      "test/**/*.test.ts",
      "test/**/*.test.tsx",
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
    ],
    environment: "node",
    environmentMatchGlobs: [["**/*.test.tsx", "jsdom"]],
    reporters: process.env.CI ? ["default", "junit"] : ["default"],
    outputFile: process.env.CI ? { junit: "test-results/junit.xml" } : undefined,
  },
});
