/**
 * Emit card palette CSS from design/palettes.json (source of truth for hi card colors).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const palettes = JSON.parse(readFileSync(join(root, "design/palettes.json"), "utf8"));

const outDir = join(root, "src/theme/tokens");
const paletteNames = ["mono", "green", "blue"];
const themes = ["light", "dark"];

const extraVars = {
  light: {
    "--chip-popover-shadow":
      "0 14px 30px -12px oklch(0.24 0.02 155 / 0.3), 0 2px 6px oklch(0.24 0.02 155 / 0.08)",
    "--sheet-scrim": "oklch(0.1 0 0 / 0.6)",
  },
  dark: {
    "--chip-popover-shadow":
      "0 14px 30px -12px oklch(0.05 0 0 / 0.45), 0 2px 6px oklch(0.05 0 0 / 0.2)",
    "--sheet-scrim": "oklch(0.05 0 0 / 0.72)",
  },
};

for (const palette of paletteNames) {
  for (const theme of themes) {
    const vars = palettes[palette]?.[theme];
    if (!vars) {
      throw new Error(`Missing palette ${palette}.${theme}`);
    }
    const lines = [
      `[data-palette="${palette}"][data-theme="${theme}"] {`,
      ...Object.entries(vars).map(([key, value]) => `  --${key}: ${value};`),
      ...Object.entries(extraVars[theme]).map(([key, value]) => `  ${key}: ${value};`),
      `  color-scheme: ${theme};`,
      "}",
      "",
    ];
    const file = join(outDir, `${palette}.${theme}.css`);
    writeFileSync(file, lines.join("\n"));
  }
}

console.log(
  `Wrote ${paletteNames.length * themes.length} palette CSS files to ${outDir}`,
);
