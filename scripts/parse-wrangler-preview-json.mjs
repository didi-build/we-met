#!/usr/bin/env node
/**
 * Extract preview.urls[0] from wrangler preview --json stdout (may include log lines).
 * Usage: npx wrangler preview ... --json 2>&1 | node scripts/parse-wrangler-preview-json.mjs
 */
import { readFileSync } from "node:fs";

const text = readFileSync(0, "utf8");
const start = text.indexOf("{");
if (start < 0) {
  console.error("parse-wrangler-preview-json: no JSON object in wrangler output");
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(text.slice(start));
} catch (error) {
  console.error("parse-wrangler-preview-json: invalid JSON:", error);
  process.exit(1);
}

const url = parsed?.preview?.urls?.[0];
if (!url || typeof url !== "string") {
  console.error("parse-wrangler-preview-json: missing preview.urls[0]");
  process.exit(1);
}

process.stdout.write(`${url}\n`);
