import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getGalleryAssetsRoot,
  getGalleryUrlPrefix,
} from "../scripts/lib/gallery-assets-root.mjs";

describe("gallery build output (unit)", () => {
  it("emits gallery SPA and _headers at the Wrangler assets root", () => {
    execFileSync("npm", ["run", "gallery:build"], { encoding: "utf8", stdio: "pipe" });
    const assetsRoot = getGalleryAssetsRoot();
    const prefix = getGalleryUrlPrefix();
    const galleryDir = prefix.replace(/^\//, "");
    const indexHtml = readFileSync(join(assetsRoot, galleryDir, "index.html"), "utf8");
    expect(indexHtml).toMatch(
      new RegExp(`${prefix.replace("/", "\\/")}/assets/index-[^"]+\\.js`),
    );
    const headers = readFileSync(join(assetsRoot, "_headers"), "utf8");
    expect(headers).toContain("X-Robots-Tag: noindex, nofollow");
    expect(headers).toContain(`${prefix}/*`);
    expect(headers).toContain("/*");
    expect(headers).not.toContain(`${galleryDir}/_headers`);
  });
});
