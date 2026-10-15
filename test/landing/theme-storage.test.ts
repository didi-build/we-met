import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY } from "@/lib/theme-storage-key";

describe("landing card-theme storage (regression)", () => {
  it("uses the card-theme localStorage key in root bootstrap and ThemeProvider", () => {
    expect(THEME_STORAGE_KEY).toBe("card-theme");

    const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
    const themeProvider = readFileSync(
      join(process.cwd(), "src/components/theme/ThemeProvider.tsx"),
      "utf8",
    );

    expect(layout).toContain("THEME_STORAGE_KEY");
    expect(themeProvider).toContain("THEME_STORAGE_KEY");
    expect(themeProvider).toContain("localStorage.setItem(THEME_STORAGE_KEY");
  });
});
