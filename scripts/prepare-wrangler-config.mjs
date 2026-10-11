#!/usr/bin/env node
/**
 * Substitute D1 database_id placeholders and write a deploy-ready Wrangler config.
 *
 * Usage:
 *   node scripts/prepare-wrangler-config.mjs --target production --output .wrangler/ci/wrangler.jsonc
 *   node scripts/prepare-wrangler-config.mjs --target preview --output .wrangler/ci/wrangler.jsonc
 *   node scripts/prepare-wrangler-config.mjs --target d1-migrate-nonprod --output .wrangler/ci/wrangler-d1-nonprod.jsonc
 *
 * Environment:
 *   WE_MET_D1_DATABASE_ID_PRODUCTION — required for --target production
 *   WE_MET_D1_DATABASE_ID_NONPROD — required for --target preview and d1-migrate-nonprod
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseJsonc } from "./lib/parse-jsonc.mjs";
import {
  D1_PLACEHOLDER_NONPROD,
  D1_PLACEHOLDER_PRODUCTION,
} from "./lib/wrangler-placeholders.mjs";

const SOURCE = resolve("wrangler.jsonc");

function usage() {
  console.error(
    "Usage: prepare-wrangler-config.mjs --target <production|preview|d1-migrate-nonprod> --output <path>",
  );
  process.exit(1);
}

function parseArgs(argv) {
  let target = null;
  let output = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--target") target = argv[++i];
    else if (arg === "--output") output = argv[++i];
    else {
      console.error(`Unknown argument: ${arg}`);
      usage();
    }
  }
  if (!target || !output) usage();
  return { target, output: resolve(output) };
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function replaceD1Ids(text, { productionId, nonprodId }) {
  let out = text;
  if (productionId) {
    out = out.replaceAll(D1_PLACEHOLDER_PRODUCTION, productionId);
  }
  if (nonprodId) {
    out = out.replaceAll(D1_PLACEHOLDER_NONPROD, nonprodId);
  }
  return out;
}

function assertNoPlaceholders(text) {
  if (
    text.includes(D1_PLACEHOLDER_PRODUCTION) ||
    text.includes(D1_PLACEHOLDER_NONPROD)
  ) {
    console.error(
      "Wrangler config still contains placeholder D1 database_id values after substitution.",
    );
    process.exit(1);
  }
}

function buildD1MigrateNonprodConfig(config, nonprodId) {
  const previewD1 = config.previews?.d1_databases?.[0];
  if (!previewD1) {
    console.error("wrangler.jsonc previews.d1_databases[0] is required.");
    process.exit(1);
  }
  return {
    $schema: config.$schema,
    migrations_dir: previewD1.migrations_dir ?? "migrations",
    d1_databases: [
      {
        binding: previewD1.binding,
        database_name: previewD1.database_name,
        database_id: nonprodId,
        migrations_dir: previewD1.migrations_dir ?? "migrations",
      },
    ],
  };
}

function main() {
  const { target, output } = parseArgs(process.argv.slice(2));
  const sourceText = readFileSync(SOURCE, "utf8");
  const config = parseJsonc(sourceText);

  if (target === "production") {
    const productionId = requireEnv("WE_MET_D1_DATABASE_ID_PRODUCTION");
    const nonprodId = requireEnv("WE_MET_D1_DATABASE_ID_NONPROD");
    const text = replaceD1Ids(sourceText, { productionId, nonprodId });
    assertNoPlaceholders(text);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, text, "utf8");
    return;
  }

  if (target === "preview") {
    const nonprodId = requireEnv("WE_MET_D1_DATABASE_ID_NONPROD");
    const productionId = process.env.WE_MET_D1_DATABASE_ID_PRODUCTION?.trim();
    let text = replaceD1Ids(sourceText, {
      productionId: productionId || D1_PLACEHOLDER_PRODUCTION,
      nonprodId,
    });
    if (!productionId) {
      console.error(
        "Warning: WE_MET_D1_DATABASE_ID_PRODUCTION unset; production placeholder left in file (preview deploy uses previews block only).",
      );
    }
    if (text.includes(D1_PLACEHOLDER_NONPROD)) {
      console.error("Failed to substitute non-prod D1 database_id.");
      process.exit(1);
    }
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, text, "utf8");
    return;
  }

  if (target === "d1-migrate-nonprod") {
    const nonprodId = requireEnv("WE_MET_D1_DATABASE_ID_NONPROD");
    const minimal = buildD1MigrateNonprodConfig(config, nonprodId);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(minimal, null, 2)}\n`, "utf8");
    return;
  }

  console.error(`Unknown --target: ${target}`);
  usage();
}

main();
