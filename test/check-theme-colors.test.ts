import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scanFileContent } from "../scripts/lib/theme-color-scan.mjs";

const fixtureDir = join(process.cwd(), "test/fixtures/theme-colors");

function fixture(name: string): string {
  return readFileSync(join(fixtureDir, name), "utf8");
}

describe("theme-color scan (unit)", () => {
  it("flags CSS named colors in color properties", () => {
    const reasons = scanFileContent(
      "test/fixtures/theme-colors/bad.css",
      fixture("bad.css"),
      ".css",
    );
    expect(reasons).toContain("css-named");
    expect(reasons).toContain("css-literal");
  });

  it("flags Tailwind default palette utilities in TSX", () => {
    const reasons = scanFileContent(
      "test/fixtures/theme-colors/bad.tsx",
      fixture("bad.tsx"),
      ".tsx",
    );
    expect(reasons).toContain("tailwind-palette");
    expect(reasons).toContain("inline-named");
  });

  it("allows token utilities and CSS variables", () => {
    const cssReasons = scanFileContent(
      "test/fixtures/theme-colors/ok.css",
      fixture("ok.css"),
      ".css",
    );
    const tsxReasons = scanFileContent(
      "test/fixtures/theme-colors/ok.tsx",
      fixture("ok.tsx"),
      ".tsx",
    );
    expect(cssReasons).toEqual([]);
    expect(tsxReasons).toEqual([]);
  });
});
