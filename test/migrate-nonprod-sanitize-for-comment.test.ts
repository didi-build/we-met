import { describe, expect, it } from "vitest";
import { sanitizeForComment } from "../scripts/migrate-nonprod/sanitize-for-comment.mjs";

describe("sanitizeForComment (unit)", () => {
  it("neutralizes HTML comment markers and backticks", () => {
    const out = sanitizeForComment("migrations/-->.sql with `ticks` and <!-- hide -->");
    expect(out).not.toContain("<!--");
    expect(out).not.toContain("-->");
    expect(out).not.toContain("`");
    expect(out).toContain("⟨!--");
    expect(out).toContain("--⟩");
    expect(out).toContain("'ticks'");
  });

  it("collapses newlines and control characters", () => {
    const out = sanitizeForComment("line1\nline2\r\n<!--\x07");
    expect(out).not.toMatch(/[\n\r\x07]/);
    expect(out).toContain("line1 line2");
  });

  it("handles triple backticks in adversarial filenames", () => {
    const out = sanitizeForComment("migrations/```evil.sql");
    expect(out).not.toContain("```");
    expect(out).toContain("'''evil.sql");
  });
});
