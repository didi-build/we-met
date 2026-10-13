import { describe, expect, it } from "vitest";
import {
  formatMarkdownCodeFence,
  longestBacktickRun,
} from "../scripts/migrate-nonprod/markdown-fence.mjs";

describe("formatMarkdownCodeFence (unit)", () => {
  it("uses minimum 3-backtick fence when content has no backticks", () => {
    const block = formatMarkdownCodeFence("SELECT 1;", "sql");
    expect(block.startsWith("```sql\n")).toBe(true);
    expect(block.trimEnd().endsWith("```")).toBe(true);
  });

  for (const run of [3, 4, 5]) {
    it(`wraps content containing a run of ${run} backticks`, () => {
      const ticks = "`".repeat(run);
      const content = `before\n${ticks}not a fence\nafter`;
      expect(longestBacktickRun(content)).toBe(run);
      const block = formatMarkdownCodeFence(content, "sql");
      const openLine = block.split("\n")[0];
      expect(openLine).toBe(`${"`".repeat(run + 1)}sql`);
      const closeFence = "`".repeat(run + 1);
      expect(block.includes(`\n${closeFence}\n`)).toBe(true);
      expect(block).toContain(content);
    });
  }
});
