import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("gallery build output (unit)", () => {
  it("emits index and assets under /gallery/ for Workers static hosting", () => {
    execFileSync("npm", ["run", "gallery:build"], { encoding: "utf8", stdio: "pipe" });
    const indexHtml = readFileSync("dist/gallery/gallery/index.html", "utf8");
    expect(indexHtml).toMatch(/\/gallery\/assets\/index-[^"]+\.js/);
    const headers = readFileSync("dist/gallery/gallery/_headers", "utf8");
    expect(headers).toContain("X-Robots-Tag: noindex, nofollow");
    expect(headers).toContain("/gallery/*");
  });
});
