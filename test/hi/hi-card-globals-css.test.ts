import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const globalsPath = join(process.cwd(), "src/app/globals.css");

describe("hi card globals.css (regression)", () => {
  const css = readFileSync(globalsPath, "utf8");

  it("sets pointer cursor on enabled buttons and selects", () => {
    expect(css).toMatch(
      /button:not\(:disabled\):not\(\[aria-busy="true"\]\)[\s\S]*cursor:\s*pointer/,
    );
    expect(css).toMatch(/select:not\(:disabled\)[\s\S]*cursor:\s*pointer/);
    expect(css).toMatch(/\[role="switch"\][\s\S]*cursor:\s*pointer/);
  });

  it("sets ink strip links to background token for contrast on bg-ink", () => {
    expect(css).toMatch(/\.hi-card-page a\.bg-ink[\s\S]*color:\s*var\(--bg\)/);
    expect(css).toContain(".hi-card-page a.hi-link-strip.bg-ink");
  });

  it("keeps hi-card link hover overrides for social and attribution links", () => {
    expect(css).toContain(".hi-card-page a.hi-link-social:hover");
    expect(css).toMatch(
      /\.hi-card-page a\.hi-link-social:hover[\s\S]*background:\s*var\(--ink\)/,
    );
    expect(css).toMatch(
      /\.hi-card-page a\.hi-link-social:hover[\s\S]*color:\s*var\(--bg\)/,
    );
    expect(css).toContain(".hi-card-page a.hi-link-attribution:hover");
    expect(css).toMatch(
      /\.hi-card-page a\.hi-link-attribution:hover[\s\S]*background:\s*var\(--surface-2\)/,
    );
    expect(css).toMatch(
      /\.hi-card-page a\.hi-link-attribution:hover[\s\S]*color:\s*var\(--ink\)/,
    );
  });
});
