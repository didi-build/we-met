import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("email templates generated module (unit)", () => {
  it("matches the six source template files", () => {
    const repoRoot = process.cwd();
    const generatedPath = join(repoRoot, "src/email/templates/generated.ts");
    const expected = execSync("node scripts/generate-email-templates.mjs --stdout", {
      cwd: repoRoot,
      encoding: "utf8",
    });
    const onDisk = readFileSync(generatedPath, "utf8");
    expect(onDisk).toBe(expected);
  });
});
