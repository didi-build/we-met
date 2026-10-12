import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
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

  it("flags both fixtures when scanned in sequence (no stale regex lastIndex)", () => {
    const first = scanFileContent(
      "test/fixtures/theme-colors/bad.css",
      fixture("bad.css"),
      ".css",
    );
    const second = scanFileContent(
      "test/fixtures/theme-colors/bad.tsx",
      fixture("bad.tsx"),
      ".tsx",
    );
    expect(first.length).toBeGreaterThan(0);
    expect(second.length).toBeGreaterThan(0);
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
