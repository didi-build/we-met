import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const globalsPath = join(process.cwd(), "src/app/globals.css");
const appEditorPath = join(process.cwd(), "src/app/app-editor.css");

describe("app preview card link colors (CSS guards)", () => {
  const globals = readFileSync(globalsPath, "utf8");
  const appEditor = readFileSync(appEditorPath, "utf8");

  it("pins hi-card strip/band ink-on-bg contrast under .hi-card-page", () => {
    expect(globals).toMatch(/\.hi-card-page a\.bg-ink[\s\S]*color:\s*var\(--bg\)/);
    expect(globals).toContain(".hi-card-page a.hi-link-strip.bg-ink");
  });

  it("keeps hi-card social, attribution, and alternate link base colors", () => {
    expect(globals).toMatch(
      /\.hi-card-page a\.hi-link-social[\s\S]*color:\s*var\(--ink\)/,
    );
    expect(globals).toMatch(
      /\.hi-card-page a\.hi-link-attribution[\s\S]*color:\s*var\(--ink-muted\)/,
    );
    expect(globals).toMatch(
      /\.hi-card-page a\.hi-link-alternate[\s\S]*color:\s*var\(--ink-muted\)/,
    );
  });

  it("does not apply editor default link color to the whole .ap subtree", () => {
    expect(appEditor).not.toMatch(/^\.ap a \{/m);
    expect(appEditor).toMatch(/\.ap :where\(\.ap-header, \.ap-bar, \.ap-dialog\) a/);
    expect(appEditor).toContain(".ap-card-preview-inert");
  });
});
