#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = process.cwd();
const ALLOWLIST = new Set([
  "src/theme/tokens/green.light.css",
  "src/theme/tokens/green.dark.css",
  "design/Hi.dc.html",
]);

const SKIP_DIRS = new Set(["node_modules", ".next", ".open-next", "dist", "coverage"]);

const CSS_COLOR_PATTERNS = [
  /#[0-9a-fA-F]{3,8}\b/,
  /\brgb\s*\(/i,
  /\brgba\s*\(/i,
  /\bhsl\s*\(/i,
  /\bhsla\s*\(/i,
  /\boklch\s*\(/i,
  /\boklab\s*\(/i,
];

const TS_COLOR_PATTERNS = [
  /#[0-9a-fA-F]{3,8}\b/,
  /\boklch\s*\(/i,
  /\brgb\s*\(/i,
  /\bhsl\s*\(/i,
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}

function scanCss(rel, text) {
  const hits = [];
  for (const pattern of CSS_COLOR_PATTERNS) {
    if (pattern.test(text)) {
      hits.push(pattern.source);
    }
  }
  return hits;
}

function scanTs(rel, text) {
  const hits = [];
  for (const pattern of TS_COLOR_PATTERNS) {
    if (pattern.test(text)) {
      hits.push(pattern.source);
    }
  }
  return hits;
}

function scanFile(path) {
  const rel = relative(repoRoot, path).replace(/\\/g, "/");
  if (ALLOWLIST.has(rel)) {
    return [];
  }
  const text = readFileSync(path, "utf8");
  if (path.endsWith(".css")) {
    const patterns = scanCss(rel, text);
    return patterns.length ? [{ file: rel, patterns }] : [];
  }
  if (path.endsWith(".ts") || path.endsWith(".tsx") || path.endsWith(".mjs")) {
    const patterns = scanTs(rel, text);
    return patterns.length ? [{ file: rel, patterns }] : [];
  }
  return [];
}

const offenders = walk(repoRoot).flatMap(scanFile);

if (offenders.length > 0) {
  console.error("Raw color literals found outside src/theme/tokens/:\n");
  for (const { file, patterns } of offenders) {
    console.error(`  ${file} (matched: ${patterns.join(", ")})`);
  }
  process.exit(1);
}

console.log("theme-colors: OK");
