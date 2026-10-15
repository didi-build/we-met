import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { collectThemeColorOffenders, walk } from "../scripts/check-theme-colors.mjs";
import { scanFileContent } from "../scripts/lib/theme-color-scan.mjs";

const fixtureDir = join(process.cwd(), "test/fixtures/theme-colors");

function fixture(name: string): string {
  return readFileSync(join(fixtureDir, name), "utf8");
}

function scanTsx(rel: string, source: string): string[] {
  return scanFileContent(rel, source, ".tsx");
}

function scanCss(rel: string, source: string): string[] {
  return scanFileContent(rel, source, ".css");
}

describe("theme-color scan (unit)", () => {
  it("flags a hover-prefixed white background utility", () => {
    const cls = "hover:bg-" + "white";
    const reasons = scanTsx(
      "x.tsx",
      `export function X() { return <div className="${cls}" />; }`,
    );
    expect(reasons).toContain("tailwind-palette");
  });

  it("flags a dark-prefixed black text utility", () => {
    const cls = "dark:text-" + "black";
    const reasons = scanTsx(
      "x.tsx",
      `export function X() { return <div className="${cls}" />; }`,
    );
    expect(reasons).toContain("tailwind-palette");
  });

  it("flags a responsive red background shade utility", () => {
    const cls = "md:bg-red-" + "500";
    const reasons = scanTsx(
      "x.tsx",
      `export function X() { return <div className="${cls}" />; }`,
    );
    expect(reasons).toContain("tailwind-palette");
  });

  it("flags a white background utility with opacity", () => {
    const cls = "bg-white/" + "50";
    const reasons = scanTsx(
      "x.tsx",
      `export function X() { return <div className="${cls}" />; }`,
    );
    expect(reasons).toContain("tailwind-palette");
  });

  it("flags an important black background utility", () => {
    const cls = "!" + "bg-" + "black";
    const reasons = scanTsx(
      "x.tsx",
      `export function X() { return <div className="${cls}" />; }`,
    );
    expect(reasons).toContain("tailwind-palette");
  });

  it("flags border: 1px solid red in CSS", () => {
    const reasons = scanCss("x.css", ".x { border: 1px solid " + "red; }");
    expect(reasons).toContain("css-named");
  });

  it("flags outline: 2px solid blue in CSS", () => {
    const reasons = scanCss("x.css", ".x { outline: 2px solid " + "blue; }");
    expect(reasons).toContain("css-named");
  });

  it("flags border-top-color: red in CSS", () => {
    const reasons = scanCss("x.css", ".x { border-top-color: " + "red; }");
    expect(reasons).toContain("css-named");
  });

  it("flags background: white in CSS", () => {
    const reasons = scanCss("x.css", ".x { background: " + "white; }");
    expect(reasons).toContain("css-named");
  });

  it("flags inline style border with a named color", () => {
    const borderValue = "1px solid " + "red";
    const reasons = scanTsx(
      "x.tsx",
      `export function X() { return <div style={{ border: "${borderValue}" }} />; }`,
    );
    expect(reasons).toContain("inline-named");
  });

  it("flags border with var() and a named color in CSS", () => {
    const reasons = scanCss("x.css", ".x { border: var(--bw) solid " + "red; }");
    expect(reasons).toContain("css-named");
  });

  it("flags box-shadow with var() and a named color in CSS", () => {
    const reasons = scanCss("x.css", ".x { box-shadow: var(--s) 0 0 " + "red; }");
    expect(reasons).toContain("css-named");
  });

  it("flags inline style border with var() and a named color", () => {
    const borderValue = "var(--w) solid " + "red";
    const reasons = scanTsx(
      "x.tsx",
      `export function X() { return <div style={{ border: "${borderValue}" }} />; }`,
    );
    expect(reasons).toContain("inline-named");
  });

  it("allows border with only var() color tokens in CSS", () => {
    const reasons = scanCss("x.css", ".x { border: var(--bw) solid var(--line); }");
    expect(reasons).not.toContain("css-named");
  });

  it("flags red in a rule after a rule without a trailing semicolon", () => {
    const red = "red";
    const reasons = scanCss("x.css", `.a { color: var(--ink) }\n.b { color: ${red} }`);
    expect(reasons).toContain("css-named");
  });

  it("flags border-inline-start-color with a named color in CSS", () => {
    const reasons = scanCss("x.css", ".x { border-inline-start-color: " + "red; }");
    expect(reasons).toContain("css-named");
  });

  it("flags border-color with a named color in CSS", () => {
    const reasons = scanCss("x.css", ".x { border-color: " + "red; }");
    expect(reasons).toContain("css-named");
  });

  it("allows border-color with a CSS variable in CSS", () => {
    const reasons = scanCss("x.css", ".x { border-color: var(--line); }");
    expect(reasons).not.toContain("css-named");
  });

  it("allows border-width without a named color in CSS", () => {
    const reasons = scanCss("x.css", ".x { border-width: 1px; }");
    expect(reasons).not.toContain("css-named");
  });

  it("allows border-style without a named color in CSS", () => {
    const reasons = scanCss("x.css", ".x { border-style: solid; }");
    expect(reasons).not.toContain("css-named");
  });

  it("flags path fill with a named color in JSX", () => {
    const fill = "red";
    const reasons = scanTsx(
      "x.tsx",
      `export function X() { return <path fill="${fill}" />; }`,
    );
    expect(reasons).toContain("jsx-attr");
  });

  it("flags path stroke with a named color in JSX", () => {
    const stroke = "white";
    const reasons = scanTsx(
      "x.tsx",
      `export function X() { return <path stroke="${stroke}" />; }`,
    );
    expect(reasons).toContain("jsx-attr");
  });

  it("flags a trailing-important white background utility", () => {
    const cls = "bg-" + "white" + "!";
    const reasons = scanTsx(
      "x.tsx",
      `export function X() { return <div className="${cls}" />; }`,
    );
    expect(reasons).toContain("tailwind-palette");
  });

  it("flags a bracket-variant white background utility", () => {
    const cls = "[&:hover]:bg-" + "white";
    const reasons = scanTsx(
      "x.tsx",
      `export function X() { return <div className="${cls}" />; }`,
    );
    expect(reasons).toContain("tailwind-palette");
  });

  it("flags a data-attribute-variant white background utility", () => {
    const cls = "data-[state=open]:bg-" + "white";
    const reasons = scanTsx(
      "x.tsx",
      `export function X() { return <div className="${cls}" />; }`,
    );
    expect(reasons).toContain("tailwind-palette");
  });

  it("allows currentColor in CSS color properties", () => {
    const reasons = scanCss("x.css", ".x { color: currentColor; }");
    expect(reasons).not.toContain("css-named");
  });

  it("allows inherit in CSS color properties", () => {
    const reasons = scanCss("x.css", ".x { color: inherit; }");
    expect(reasons).not.toContain("css-named");
  });

  it("allows none in CSS color properties", () => {
    const reasons = scanCss("x.css", ".x { text-decoration: none; }");
    expect(reasons).not.toContain("css-named");
  });

  it("allows transparent in CSS color properties", () => {
    const reasons = scanCss("x.css", ".x { background-color: transparent; }");
    expect(reasons).not.toContain("css-named");
  });

  it("allows var(--ink) in CSS color properties", () => {
    const reasons = scanCss("x.css", ".x { color: var(--ink); }");
    expect(reasons).not.toContain("css-named");
  });

  it("allows fill currentColor in JSX", () => {
    const reasons = scanTsx(
      "x.tsx",
      `export function X() { return <path fill="currentColor" />; }`,
    );
    expect(reasons).not.toContain("jsx-attr");
  });

  it("allows fill none in JSX", () => {
    const reasons = scanTsx(
      "x.tsx",
      `export function X() { return <path fill="none" />; }`,
    );
    expect(reasons).not.toContain("jsx-attr");
  });

  it("allows stroke currentColor in JSX", () => {
    const reasons = scanTsx(
      "x.tsx",
      `export function X() { return <path stroke="currentColor" />; }`,
    );
    expect(reasons).not.toContain("jsx-attr");
  });

  it("allows bg-accent/50", () => {
    const reasons = scanTsx(
      "x.tsx",
      `export function X() { return <div className="bg-accent/50" />; }`,
    );
    expect(reasons).not.toContain("tailwind-palette");
  });

  it("allows bg-accent, text-ink, and border-line", () => {
    const reasons = scanTsx(
      "x.tsx",
      `export function X() { return <div className="bg-accent text-ink border-line" />; }`,
    );
    expect(reasons).not.toContain("tailwind-palette");
  });

  it("flags the same single-match source on every repeated scan", () => {
    const cls = "bg-" + "white";
    const source = `export function X() { return <div className="${cls}" />; }`;
    for (let i = 0; i < 3; i += 1) {
      const reasons = scanTsx("x.tsx", source);
      expect(reasons).toContain("tailwind-palette");
    }
  });

  it("skips the repo-root design/ directory when walking for theme colors", () => {
    const root = mkdtempSync(join(tmpdir(), "theme-colors-walk-"));
    try {
      mkdirSync(join(root, "design"));
      const designHex = "#" + "ff0000";
      const srcHex = "#" + "00ff00";
      writeFileSync(join(root, "design", "ref.css"), `.x { color: ${designHex}; }`);
      mkdirSync(join(root, "src"));
      writeFileSync(join(root, "src", "app.css"), `.y { color: ${srcHex}; }`);

      const files = walk(root).map((path) => relative(root, path).replace(/\\/g, "/"));
      expect(files).not.toContain("design/ref.css");
      expect(files).toContain("src/app.css");

      const offenders = collectThemeColorOffenders(root);
      expect(offenders.some(({ file }) => file === "design/ref.css")).toBe(false);
      expect(offenders.some(({ file }) => file === "src/app.css")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("allows token utilities and CSS variables in fixtures", () => {
    const cssReasons = scanFileContent(
      "test/fixtures/theme-colors/ok.css",
      fixture("ok.css"),
      ".css",
    );
    const tsxReasons = scanFileContent(
      "test/fixtures/theme-colors/ok.tsx",
      fixture("ok.tsx"),
      ".tsx",
    );
    expect(cssReasons).toEqual([]);
    expect(tsxReasons).toEqual([]);
  });
});
