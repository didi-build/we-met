import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import globals from "globals";

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
      "design/**",
      "test/fixtures/privileged-workflow-import-walk/resolution/entry-same-line-typeof.mjs",
      "test/fixtures/privileged-workflow-import-walk/resolution/entry-same-line-await.mjs",
      "test/fixtures/privileged-workflow-import-walk/resolution/entry-same-line-case.mjs",
      "test/fixtures/privileged-workflow-import-walk/resolution/entry-same-line-brace.mjs",
      "test/fixtures/privileged-workflow-import-walk/resolution/entry-same-line-return.mjs",
      "test/fixtures/privileged-workflow-import-walk/resolution/entry-regex-glob-bash.mjs",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript", "prettier"),
  {
    files: ["scripts/**/*.{js,mjs}", "test/**/*.ts", "vitest.config.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    ignores: ["test/**/*.integration.test.ts", "test/**/*.integration.test.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/helpers/d1", "**/helpers/d1.ts"],
              message: "Import test/helpers/d1 only from *.integration.test.ts files.",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "test/fixtures/privileged-workflow-import-walk/resolution/entry-plain-require.cjs",
      "test/fixtures/privileged-workflow-import-walk/resolution/entry-import-equals.cts",
    ],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["gallery/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
      },
    },
  },
];

export default eslintConfig;
