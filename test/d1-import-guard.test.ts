import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function eslintExitCode(paths: string[]): number {
  try {
    execFileSync("npx", ["eslint", ...paths], { encoding: "utf8", stdio: "pipe" });
    return 0;
  } catch (error) {
    const status = (error as NodeJS.ErrnoException & { status?: number }).status;
    return typeof status === "number" ? status : 1;
  }
}

describe("d1 helper import guard (unit)", () => {
  it("eslint config restricts d1 helper imports to integration tests", () => {
    const config = readFileSync("eslint.config.js", "utf8");
    expect(config).toContain("no-restricted-imports");
    expect(config).toContain("helpers/d1");
    expect(config).toContain("integration.test");
  });

  it("eslint rejects unit tests that import test/helpers/d1", () => {
    const dir = mkdtempSync(join(process.cwd(), "test", ".tmp-d1-guard-"));
    const offender = join(dir, "offender.test.ts");
    writeFileSync(
      offender,
      'import { withIsolatedLocalD1 } from "../helpers/d1";\nexport {};\n',
    );
    try {
      expect(eslintExitCode([offender])).not.toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("eslint allows integration tests that import test/helpers/d1", () => {
    expect(eslintExitCode(["test/app-auth/sessions-d1.integration.test.ts"])).toBe(0);
  });
});
