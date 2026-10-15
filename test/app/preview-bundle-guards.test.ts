import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("App card preview inertness (static)", () => {
  it("AppCardPreview uses HiCardPresentation with preview and interactive", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/app/editor/AppCardPreview.tsx"),
      "utf8",
    );
    expect(src).toContain("HiCardPresentation");
    expect(src).toContain("preview");
    expect(src).toContain("interactive");
    expect(src).toContain("blockPreviewLinkNavigation");
    expect(src).toContain("MirroredThemeProvider");
    expect(src).not.toContain("HiPageClient");
    expect(src).not.toMatch(/\binert\b/);
  });

  it("HiCardPresentation supports preview-only exchange inertness", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/hi/HiCardPresentation.tsx"),
      "utf8",
    );
    expect(src).toMatch(/preview \?/);
    expect(src).toContain("interactive");
  });
});
