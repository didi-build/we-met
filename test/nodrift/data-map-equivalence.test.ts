import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("nodrift data map conversion equivalence", () => {
  it("matches the pre-nodrift flat snapshot for every kept field", () => {
    const output = execFileSync("node", ["scripts/check-data-map-equivalence.mjs"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(output).toMatch(/equivalence ok/);
  });
});
