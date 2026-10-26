#!/usr/bin/env node
import { existsSync, rmSync, writeFileSync } from "node:fs";

const rootHeaders = "dist/gallery/_headers";
const nestedHeaders = "dist/gallery/gallery/_headers";

writeFileSync(rootHeaders, "/*\n  X-Robots-Tag: noindex, nofollow\n\n", "utf8");

if (existsSync(nestedHeaders)) {
  rmSync(nestedHeaders);
}
