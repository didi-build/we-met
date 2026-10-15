import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("editor limits parity (unit)", () => {
  it("AppCardEditor imports CARD_FIELD_LIMITS only from card-data/limits", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/app/AppCardEditor.tsx"),
      "utf8",
    );
    expect(src).toContain('from "@/card-data/limits"');
    expect(src).toContain("CARD_FIELD_LIMITS");
    expect(src).not.toMatch(/aboutParagraphs:\s*\d/);
    expect(src).not.toMatch(/slugMin:\s*\d/);
  });
});
