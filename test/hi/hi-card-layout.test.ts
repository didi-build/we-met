import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const layoutPath = join(process.cwd(), "src/app/hi/[slug]/layout.tsx");

describe("hi card layout (regression)", () => {
  it("does not pin data-theme on an inner wrapper", () => {
    const src = readFileSync(layoutPath, "utf8");
    expect(src).not.toMatch(/data-theme\s*=\s*["']light["']/);
    expect(src).not.toMatch(/data-palette\s*=\s*\{/);
  });
});
