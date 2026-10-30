import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ESLint, type Linter } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

const D1_IMPORT_SOURCE =
  'import { withIsolatedLocalD1 } from "../helpers/d1";\nexport {};\n';

function hasD1ImportRestriction(messages: Linter.LintMessage[]): boolean {
  return messages.some(
    (message) =>
      message.ruleId === "no-restricted-imports" &&
      message.message.includes("helpers/d1"),
  );
}

function lintMessages(results: ESLint.LintResult[]): Linter.LintMessage[] {
  return results.flatMap((result) => result.messages);
}

describe("d1 helper import guard (unit)", () => {
  let eslint: ESLint;

  beforeAll(async () => {
    eslint = new ESLint({ cwd: process.cwd() });
  });

  it("eslint config restricts d1 helper imports to integration tests", () => {
    const config = readFileSync("eslint.config.js", "utf8");
    expect(config).toContain("no-restricted-imports");
    expect(config).toContain("helpers/d1");
    expect(config).toContain("integration.test");
    expect(config).toContain("test/**/*.test.ts");
    expect(config).toContain("test/**/*.test.tsx");
  });

  it("eslint rejects unit .test.ts files that import test/helpers/d1", async () => {
    const results = await eslint.lintText(D1_IMPORT_SOURCE, {
      filePath: join(process.cwd(), "test", ".tmp-d1-guard", "offender.test.ts"),
    });
    expect(hasD1ImportRestriction(lintMessages(results))).toBe(true);
  });

  it("eslint rejects unit .test.tsx files that import test/helpers/d1", async () => {
    const results = await eslint.lintText(D1_IMPORT_SOURCE, {
      filePath: join(process.cwd(), "test", ".tmp-d1-guard", "offender.test.tsx"),
    });
    expect(hasD1ImportRestriction(lintMessages(results))).toBe(true);
  });

  it("eslint allows integration tests that import test/helpers/d1", async () => {
    const results = await eslint.lintFiles([
      "test/app-auth/sessions-d1.integration.test.ts",
    ]);
    expect(hasD1ImportRestriction(lintMessages(results))).toBe(false);
  });
});
