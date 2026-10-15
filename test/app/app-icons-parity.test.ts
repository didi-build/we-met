import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ICONS_TS = join(process.cwd(), "src/components/app/icons/AppIcons.tsx");
const DESIGN_DIR = join(process.cwd(), "design/app/icons");

describe("AppIcons vs design/app/icons (unit)", () => {
  it("re-exports WeMetMarkIcon with useId (no fixed mask id in AppIcons)", () => {
    const src = readFileSync(ICONS_TS, "utf8");
    expect(src).toContain("WeMetMarkIcon as AppWeMetMarkIcon");
    expect(src).not.toMatch(/id="mask"/);
    expect(src).not.toMatch(/mask="url\(#mask\)/);
  });

  it("stroke icons use currentColor and strokeWidth", () => {
    const src = readFileSync(ICONS_TS, "utf8");
    const strokeBlocks = src.split(/export function \w+Icon/);
    for (const block of strokeBlocks) {
      if (!block.includes('fill="none"') || !block.includes("stroke=")) {
        continue;
      }
      expect(block).toContain('stroke="currentColor"');
      expect(block).toMatch(/strokeWidth=/);
    }
  });

  it("lists a React icon for each design export except README", () => {
    const src = readFileSync(ICONS_TS, "utf8");
    const files = readdirSync(DESIGN_DIR).filter((f) => f.endsWith(".svg"));
    const kebabToPascal = (name: string) =>
      name
        .replace(/\.svg$/, "")
        .split("-")
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join("");

    for (const file of files) {
      const base = file.replace(/\.svg$/, "");
      if (base === "google-g") {
        expect(src).toContain("GoogleGIcon");
        continue;
      }
      if (base === "we-met-mark") {
        expect(src).toContain("AppWeMetMarkIcon");
        continue;
      }
      const iconName = `${kebabToPascal(file)}Icon`;
      expect(src, `missing export for design icon ${file}`).toContain(iconName);
    }
  });
});
