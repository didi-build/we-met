#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { scanFileContent, SKIP_DIRS } from "./lib/theme-color-scan.mjs";

const repoRoot = process.cwd();

export function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) {
      continue;
    }
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

export function scanFile(path, root = repoRoot) {
  const rel = relative(root, path).replace(/\\/g, "/");
  if (rel.startsWith("test/fixtures/")) {
    return [];
  }
  const ext = path.slice(path.lastIndexOf("."));
  if (![".css", ".ts", ".tsx", ".mjs"].includes(ext)) {
    return [];
  }
  const reasons = scanFileContent(rel, readFileSync(path, "utf8"), ext);
  return reasons.length ? [{ file: rel, reasons }] : [];
}

export function collectThemeColorOffenders(root = repoRoot) {
  return walk(root).flatMap((path) => scanFile(path, root));
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;

if (isMain) {
  const offenders = collectThemeColorOffenders(repoRoot);

  if (offenders.length > 0) {
    console.error("Raw color literals found outside src/theme/tokens/:\n");
    for (const { file, reasons } of offenders) {
      console.error(`  ${file} (${reasons.join(", ")})`);
    }
    process.exit(1);
  }

  console.log("theme-colors: OK");
}
