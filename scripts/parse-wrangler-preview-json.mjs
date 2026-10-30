#!/usr/bin/env node
/**
 * Extract preview.urls[0] from wrangler preview --json stdout (may include log lines).
 * Usage: npx wrangler preview ... --json 2>&1 | node scripts/parse-wrangler-preview-json.mjs
 *
 * On failure, stderr includes preview.urls (when JSON parsed) plus a short error only,
 * not the full wrangler JSON (which may contain Cloudflare author_id).
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
} catch {
  console.error("parse-wrangler-preview-json: invalid JSON");
  process.exit(1);
}

function logTrimmedPreviewFailure(message) {
  const urls = parsed?.preview?.urls;
  if (Array.isArray(urls)) {
    console.error(`preview.urls: ${JSON.stringify(urls)}`);
  }
  console.error(`parse-wrangler-preview-json: ${message}`);
}

const url = parsed?.preview?.urls?.[0];
if (!url || typeof url !== "string") {
  logTrimmedPreviewFailure("missing preview.urls[0]");
  process.exit(1);
}

process.stdout.write(`${url}\n`);
