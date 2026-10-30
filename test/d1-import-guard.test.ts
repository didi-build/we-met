import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ESLint, type Linter } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

const LINT_TEST_TIMEOUT_MS = 20_000;
const BEFORE_ALL_TIMEOUT_MS = 30_000;

const D1_IMPORT_SOURCE =
  'import { withIsolatedLocalD1 } from "../helpers/d1";\nexport {};\n';

const unitOffenderTs = join(process.cwd(), "test", ".tmp-d1-guard", "offender.test.ts");
const unitOffenderTsx = join(
  process.cwd(),
  "test",
  ".tmp-d1-guard",
  "offender.test.tsx",
);

function d1ImportRestrictionMessages(
  messages: Linter.LintMessage[],
): Linter.LintMessage[] {
  return messages.filter(
    (message) =>
      message.ruleId === "no-restricted-imports" &&
      message.message.includes("helpers/d1"),
  );
}

function lintMessages(results: ESLint.LintResult[]): Linter.LintMessage[] {
  return results.flatMap((result) => result.messages);
}

function expectRuleConfiguredAsError(rule: Linter.RuleEntry | undefined): void {
  expect(rule).toBeDefined();
  if (rule === undefined) {
    return;
  }
  const level = Array.isArray(rule) ? rule[0] : rule;
  if (typeof level === "number") {
    expect(level).toBe(2);
    return;
  }
  expect(level).toBe("error");
}

describe("d1 helper import guard (unit)", () => {
  let eslint: ESLint;

  beforeAll(async () => {
    eslint = new ESLint({ cwd: process.cwd() });
    await eslint.calculateConfigForFile(unitOffenderTs);
    await eslint.lintText(D1_IMPORT_SOURCE, { filePath: unitOffenderTs });
  }, BEFORE_ALL_TIMEOUT_MS);

  it("eslint config restricts d1 helper imports to integration tests", () => {
    const config = readFileSync("eslint.config.js", "utf8");
    expect(config).toContain("no-restricted-imports");
    expect(config).toContain("helpers/d1");
    expect(config).toContain("integration.test");
    expect(config).toContain("test/**/*.test.ts");
    expect(config).toContain("test/**/*.test.tsx");
    expect(config).toMatch(/no-restricted-imports[\s\S]*?["']error["']/);
  });

  it(
    "calculateConfigForFile sets no-restricted-imports to error for unit tests",
    async () => {
      const config = await eslint.calculateConfigForFile(unitOffenderTs);
      expectRuleConfiguredAsError(config.rules?.["no-restricted-imports"]);
      const tsxConfig = await eslint.calculateConfigForFile(unitOffenderTsx);
      expectRuleConfiguredAsError(tsxConfig.rules?.["no-restricted-imports"]);
    },
    LINT_TEST_TIMEOUT_MS,
  );

  it(
    "eslint rejects unit .test.ts files that import test/helpers/d1",
    async () => {
      const results = await eslint.lintText(D1_IMPORT_SOURCE, {
        filePath: unitOffenderTs,
      });
      const violations = d1ImportRestrictionMessages(lintMessages(results));
      expect(violations.length).toBeGreaterThan(0);
      for (const message of violations) {
        expect(message.severity).toBe(2);
      }
    },
    LINT_TEST_TIMEOUT_MS,
  );

  it(
    "eslint rejects unit .test.tsx files that import test/helpers/d1",
    async () => {
      const results = await eslint.lintText(D1_IMPORT_SOURCE, {
        filePath: unitOffenderTsx,
      });
      const violations = d1ImportRestrictionMessages(lintMessages(results));
      expect(violations.length).toBeGreaterThan(0);
      for (const message of violations) {
        expect(message.severity).toBe(2);
      }
    },
    LINT_TEST_TIMEOUT_MS,
  );

  it(
    "eslint allows integration tests that import test/helpers/d1",
    async () => {
      const results = await eslint.lintFiles([
        "test/app-auth/sessions-d1.integration.test.ts",
      ]);
      expect(d1ImportRestrictionMessages(lintMessages(results))).toHaveLength(0);
    },
    LINT_TEST_TIMEOUT_MS,
  );
});
