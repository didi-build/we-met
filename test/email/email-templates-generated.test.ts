import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildGeneratedEmailTemplatesSource } from "../../scripts/generate-email-templates.mjs";
import { describe, expect, it } from "vitest";

describe("email templates generated module (unit)", () => {
  const repoRoot = process.cwd();
  const generatedPath = join(repoRoot, "src/email/templates/generated.ts");

  it("matches the six source template files", () => {
    const expected = buildGeneratedEmailTemplatesSource();
    const onDisk = readFileSync(generatedPath, "utf8");
    expect(onDisk).toBe(expected);
  });

  it("npm run email-templates:check fails when generated.ts is stale", () => {
    const before = readFileSync(generatedPath, "utf8");
    writeFileSync(generatedPath, `${before}// stale\n`, "utf8");
    try {
      expect(() =>
        execSync("npm run email-templates:check", {
          cwd: repoRoot,
          encoding: "utf8",
          stdio: "pipe",
        }),
      ).toThrow();
    } finally {
      writeFileSync(generatedPath, before, "utf8");
    }
  });
});
