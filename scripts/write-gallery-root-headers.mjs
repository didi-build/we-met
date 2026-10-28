#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  getGalleryAssetsRoot,
  getGalleryUrlPrefix,
} from "./lib/gallery-assets-root.mjs";

const prefix = getGalleryUrlPrefix();
const assetsRoot = getGalleryAssetsRoot();
const headersPath = join(assetsRoot, "_headers");

const blocks = [`${prefix}/*`, "/*"].map(
  (pattern) => `${pattern}\n\tX-Robots-Tag: noindex, nofollow`,
);

writeFileSync(headersPath, `${blocks.join("\n\n")}\n`, "utf8");
