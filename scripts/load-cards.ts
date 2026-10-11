#!/usr/bin/env node
/**
 * Load cards from a local gitignored JSON file into D1.
 *
 * Usage:
 *   npx tsx scripts/load-cards.ts [--file data/cards.local.json]
 *   npx tsx scripts/load-cards.ts --remote [--production] [--file path]
 */
import { createInterface } from "node:readline/promises";
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { D1CardRepository } from "../src/card-data/d1-repository.ts";
import { parseCardsLoadFile } from "../src/card-data/load-file.ts";

const D1_CI_CONFIG_REL = "wrangler.d1-nonprod.ci.jsonc";
const DEFAULT_FILE = "data/cards.local.json";

const args = process.argv.slice(2);
let mode: "local" | "remote" = "local";
let filePath = DEFAULT_FILE;
let production = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--local") {
    mode = "local";
  } else if (arg === "--remote") {
    mode = "remote";
  } else if (arg === "--production") {
    production = true;
  } else if (arg === "--file") {
    filePath = args[++i] ?? "";
    if (!filePath) {
      console.error("--file requires a path");
      process.exit(1);
    }
  } else if (arg.startsWith("-")) {
    console.error(`Unknown option: ${arg}`);
    process.exit(1);
  } else {
    console.error(`Unexpected argument: ${arg}`);
    process.exit(1);
  }
}

if (mode === "remote" && !production) {
  if (!process.env.WE_MET_D1_DATABASE_ID_NONPROD?.trim()) {
    console.error(
      "WE_MET_D1_DATABASE_ID_NONPROD is required for non-prod remote load.",
    );
    process.exit(1);
  }
}

if (mode === "remote" && production) {
  if (!process.env.WE_MET_D1_DATABASE_ID_PRODUCTION?.trim()) {
    console.error(
      "WE_MET_D1_DATABASE_ID_PRODUCTION is required for --remote --production.",
    );
    process.exit(1);
  }
  const rl = createInterface({ input, output });
  const answer = await rl.question(
    'Type "production" to load cards into the production D1 database: ',
  );
  rl.close();
  if (answer.trim() !== "production") {
    console.error("Aborted: production confirmation did not match.");
    process.exit(1);
  }
}

let raw: string;
try {
  raw = readFileSync(resolve(filePath), "utf8");
} catch (error) {
  console.error(`Failed to read load file: ${filePath}`);
  console.error(error);
  process.exit(1);
}

let loadFile;
try {
  loadFile = parseCardsLoadFile(JSON.parse(raw));
} catch (error) {
  console.error("Invalid load file:");
  console.error(error);
  process.exit(1);
}

const productionConfigPath = resolve("wrangler.load-production.ci.jsonc");
const nonprodConfigPath = resolve(D1_CI_CONFIG_REL);

if (mode === "remote") {
  const prep = spawnSync(
    "node",
    [
      "scripts/prepare-wrangler-config.mjs",
      "--target",
      production ? "production" : "d1-migrate-nonprod",
      "--output",
      production ? "wrangler.load-production.ci.jsonc" : D1_CI_CONFIG_REL,
    ],
    { encoding: "utf8" },
  );
  if (prep.status !== 0) {
    if (prep.stderr) process.stderr.write(prep.stderr);
    process.exit(prep.status ?? 1);
  }
}

const { getPlatformProxy } = await import("wrangler");

const configPath =
  mode === "remote"
    ? production
      ? productionConfigPath
      : nonprodConfigPath
    : resolve("wrangler.jsonc");

const proxy = await getPlatformProxy({
  configPath,
  remoteBindings: mode === "remote",
});

try {
  const db = proxy.env.WE_MET_DB as D1Database;
  if (!db) {
    throw new Error("WE_MET_DB binding is not available");
  }
  const repo = new D1CardRepository(db);
  for (const card of loadFile.cards) {
    await repo.upsertCard(card);
    console.log(`Loaded card: ${card.slug}`);
  }
  for (const mapping of loadFile.hostnames) {
    await repo.upsertHostname(mapping);
    console.log(`Mapped hostname: ${mapping.hostname} → ${mapping.slug}`);
  }
} catch (error) {
  console.error(error);
  process.exit(1);
} finally {
  await proxy.dispose?.();
  if (mode === "remote") {
    try {
      rmSync(nonprodConfigPath, { force: true });
      rmSync(productionConfigPath, { force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}
