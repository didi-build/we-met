import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "coverage/**",
      "test-results/**",
      ".next/**",
      ".open-next/**",
      ".wrangler/**",
      "out/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript", "prettier"),
  {
    files: ["scripts/**/*.{js,mjs}", "test/**/*.ts", "vitest.config.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default eslintConfig;
