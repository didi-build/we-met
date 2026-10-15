import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("App card preview inertness (static)", () => {
  it("AppCardPreview wraps HiPageClient with preview flag", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/app/editor/AppCardPreview.tsx"),
      "utf8",
    );
    expect(src).toContain("preview");
    expect(src).toContain("inert");
    expect(src).toContain("MirroredThemeProvider");
  });

  it("HiPageClient skips exchange chrome when preview is true", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/hi/HiPageClient.tsx"),
      "utf8",
    );
    expect(src).toMatch(/!preview &&/);
    expect(src).toContain('preview ? "free"');
  });
});
