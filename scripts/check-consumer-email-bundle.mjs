#!/usr/bin/env node
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const CONFIGS = [
  "workers/we-met-followup-email-consumer/wrangler.nonprod.jsonc",
  "workers/we-met-followup-email-consumer/wrangler.production.jsonc",
];

const MARKER = "Get your own card for free";
const FORBIDDEN = ["readFileSync", "node:fs"];

function checkBundle(configRel) {
  const outdir = mkdtempSync(join(tmpdir(), "we-met-consumer-bundle-"));
  try {
    execSync(
      `npx wrangler deploy --dry-run --outdir "${outdir}" --config "${join(repoRoot, configRel)}"`,
      { cwd: repoRoot, stdio: "pipe", encoding: "utf8" },
    );
    const bundlePath = join(outdir, "index.js");
    const bundle = readFileSync(bundlePath, "utf8");
    if (!bundle.includes(MARKER)) {
      throw new Error(`${configRel}: bundle missing template marker "${MARKER}"`);
    }
    for (const needle of FORBIDDEN) {
      if (bundle.includes(needle)) {
        throw new Error(`${configRel}: bundle must not contain "${needle}"`);
      }
    }
    console.log(`consumer bundle OK (${configRel})`);
  } finally {
    rmSync(outdir, { recursive: true, force: true });
  }
}

for (const config of CONFIGS) {
  checkBundle(config);
}
