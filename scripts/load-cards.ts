#!/usr/bin/env node
/**
 * Load cards from a local gitignored JSON file into D1 via wrangler d1 execute.
 *
 * Usage:
 *   npx tsx scripts/load-cards.ts [--file data/cards.local.json]
 *   npx tsx scripts/load-cards.ts --remote [--file path]
 *   npx tsx scripts/load-cards.ts --remote --production [--file path]
 *   npx tsx scripts/load-cards.ts --validate-only [--file path]
 */
import { createInterface } from "node:readline/promises";
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execPath, stdin as input, stdout as output } from "node:process";
import { buildWranglerArgs } from "./lib/build-wrangler-args.ts";
import { buildCardsLoadSql, newCardIdsForLoad } from "../src/card-data/load-sql.ts";
import { parseCardsLoadFile } from "../src/card-data/load-file.ts";

const D1_CI_CONFIG_REL = "wrangler.d1-nonprod.ci.jsonc";
const PRODUCTION_CI_CONFIG_REL = "wrangler.load-production.ci.jsonc";
const DEFAULT_FILE = "data/cards.local.json";

const args = process.argv.slice(2);
let mode: "local" | "remote" = "local";
let filePath = DEFAULT_FILE;
let production = false;
let validateOnly = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--local") {
    mode = "local";
  } else if (arg === "--remote") {
    mode = "remote";
  } else if (arg === "--validate-only") {
    validateOnly = true;
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

if (production && mode !== "remote") {
  console.error("--production requires --remote");
  process.exit(1);
}

async function main(): Promise<void> {
  let raw: string;
  try {
    raw = readFileSync(resolve(filePath), "utf8");
  } catch (error) {
    console.error(`Failed to read load file: ${filePath}`);
    console.error(error);
    process.exitCode = 1;
    return;
  }

  let loadFile;
  try {
    loadFile = parseCardsLoadFile(JSON.parse(raw));
  } catch (error) {
    console.error("Invalid load file:");
    console.error(error);
    process.exitCode = 1;
    return;
  }

  if (validateOnly) {
    console.log(
      `OK: ${loadFile.cards.length} cards, ${loadFile.hostnames.length} hostnames`,
    );
    return;
  }

  if (mode === "remote" && !production) {
    if (!process.env.WE_MET_D1_DATABASE_ID_NONPROD?.trim()) {
      console.error(
        "WE_MET_D1_DATABASE_ID_NONPROD is required for non-prod remote load.",
      );
      process.exitCode = 1;
      return;
    }
  }

  if (mode === "remote" && production) {
    if (!process.env.WE_MET_D1_DATABASE_ID_PRODUCTION?.trim()) {
      console.error(
        "WE_MET_D1_DATABASE_ID_PRODUCTION is required for --remote --production.",
      );
      process.exitCode = 1;
      return;
    }
    const rl = createInterface({ input, output });
    const answer = await rl.question(
      'Type "production" to load cards into the production D1 database: ',
    );
    rl.close();
    if (answer.trim() !== "production") {
      console.error("Aborted: production confirmation did not match.");
      process.exitCode = 1;
      return;
    }
  }

  const sqlRel = `load-${process.pid}.sql`;
  const generatedConfigs: string[] = [];
  let configRel: string | null = null;

  try {
    const updatedAt = new Date().toISOString();
    const newCardIds = newCardIdsForLoad(loadFile);
    const sql = buildCardsLoadSql(loadFile, { updatedAt, newCardIds });
    writeFileSync(sqlRel, sql, "utf8");

    if (mode === "remote") {
      configRel = production ? PRODUCTION_CI_CONFIG_REL : D1_CI_CONFIG_REL;
      generatedConfigs.push(configRel);
      const prep = spawnSync(
        "node",
        [
          "scripts/prepare-wrangler-config.mjs",
          "--target",
          production ? "production" : "d1-migrate-nonprod",
          "--output",
          configRel,
        ],
        { encoding: "utf8" },
      );
      if (prep.status !== 0) {
        if (prep.stderr) process.stderr.write(prep.stderr);
        process.exitCode = prep.status ?? 1;
        return;
      }
    }

    if (
      process.env.NODE_ENV === "test" &&
      process.env.WE_MET_LOAD_CARDS_TEST_FAIL_AFTER_CONFIG === "1"
    ) {
      throw new Error("WE_MET_LOAD_CARDS_TEST_FAIL_AFTER_CONFIG");
    }

    const execute = spawnSync(
      execPath,
      buildWranglerArgs({
        kind: "execute-file",
        configRel,
        remote: mode === "remote",
        sqlRel,
      }),
      { stdio: "inherit" },
    );
    if (execute.status !== 0) {
      process.exitCode = execute.status ?? 1;
      return;
    }

    for (const card of loadFile.cards) {
      console.log(`Loaded card: ${card.slug}`);
    }
    for (const mapping of loadFile.hostnames) {
      console.log(`Mapped hostname: ${mapping.hostname} → ${mapping.slug}`);
    }

    if (mode === "remote") {
      const readBack = spawnSync(
        execPath,
        buildWranglerArgs({ kind: "read-back", configRel }),
        { encoding: "utf8" },
      );
      if (readBack.stdout) process.stdout.write(readBack.stdout);
      if (readBack.stderr) process.stderr.write(readBack.stderr);
      if (readBack.status !== 0) {
        process.exitCode = readBack.status ?? 1;
      }
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    for (const path of generatedConfigs) {
      try {
        rmSync(resolve(path), { force: true });
      } catch {
        // ignore cleanup errors
      }
    }
    try {
      rmSync(resolve(sqlRel), { force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

await main();
