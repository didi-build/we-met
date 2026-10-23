import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("nodrift check 2 (binding not in map)", () => {
  it("fails when Wrangler declares an undeclared binding", () => {
    const output = execFileSync("node", ["scripts/check-nodrift-binding-fixture.mjs"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(output).toMatch(/binding fixture ok/);
  });
});
