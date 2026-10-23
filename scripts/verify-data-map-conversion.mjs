/**
 * One-off: verify grouped docs/privacy/data-map.yml matches a legacy flat YAML list.
 *
 * Usage: node scripts/verify-data-map-conversion.mjs <path-to-flat.yml>
 *
 * Paste the printed summary into the PR when converting the map. Not run in CI or npm test.
 *
 * Allows extra other_items ids that exist only for nodrift Check 2 (not in the flat map):
 * binding.d1_we_met_db
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const yaml = require(
  require.resolve("yaml", {
    paths: [path.dirname(require.resolve("@didi-build/nodrift/package.json"))],
  }),
);

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nodriftApi = path.join(
  repoRoot,
  "node_modules/@didi-build/nodrift/dist/index.js",
);
const { expandDataMap, parseDataMap } = await import(
  new URL(`file://${nodriftApi}`).href
);

const EXTRA_OTHER_ITEM_IDS = new Set(["binding.d1_we_met_db"]);

const KEPT_FIELDS = [
  "whose",
  "data",
  "purpose",
  "storage",
  "processors",
  "retention",
  "who_can_see",
  "source",
  "verified",
];

function expandedPlain(entry) {
  const plain = { id: entry.id };
  if (entry.kind === "d1_column") {
    plain.table = entry.table;
    plain.column = entry.column;
  }
  for (const key of KEPT_FIELDS) {
    const wrapped = entry[key];
    if (wrapped?.value !== undefined) {
      plain[key] = wrapped.value;
    }
  }
  return plain;
}

function pickKeptFields(entry) {
  const picked = { id: entry.id };
  if (entry.table !== undefined) {
    picked.table = entry.table;
  }
  if (entry.column !== undefined) {
    picked.column = entry.column;
  }
  for (const key of KEPT_FIELDS) {
    if (entry[key] !== undefined) {
      picked[key] = entry[key];
    }
  }
  return picked;
}

function main() {
  const flatPath = process.argv[2];
  if (!flatPath) {
    console.error(
      "usage: node scripts/verify-data-map-conversion.mjs <path-to-flat.yml>",
    );
    process.exit(2);
  }
  const mapPath = path.join(repoRoot, "docs/privacy/data-map.yml");
  const flat = yaml.parse(fs.readFileSync(flatPath, "utf8"));
  const mapText = fs.readFileSync(mapPath, "utf8");
  const parsed = parseDataMap(mapText, mapPath);
  if (parsed.fatal) {
    console.error(`fatal: ${parsed.fatal.message}`);
    process.exit(1);
  }
  if (parsed.findings?.length) {
    console.error(`findings: ${JSON.stringify(parsed.findings)}`);
    process.exit(1);
  }

  const expanded = expandDataMap(parsed.map);
  const expandedById = new Map(expanded.map((e) => [e.id, expandedPlain(e)]));
  const flatIds = new Set(flat.map((e) => e.id));

  const mismatches = [];
  for (const flatEntry of flat) {
    const expected = pickKeptFields(flatEntry);
    const actual = expandedById.get(flatEntry.id);
    if (!actual) {
      mismatches.push(`missing expanded entry for ${flatEntry.id}`);
      continue;
    }
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      mismatches.push(flatEntry.id);
    }
  }

  const extraExpanded = expanded.filter(
    (e) => !flatIds.has(e.id) && !EXTRA_OTHER_ITEM_IDS.has(e.id),
  );
  if (extraExpanded.length > 0) {
    mismatches.push(
      `unexpected expanded ids: ${extraExpanded.map((e) => e.id).join(", ")}`,
    );
  }

  if (mismatches.length > 0) {
    console.error(
      `equivalence failed (${mismatches.length}): ${mismatches.slice(0, 8).join("; ")}`,
    );
    process.exit(1);
  }

  console.log(
    `equivalence ok: ${flat.length} flat entries, ${expanded.length} expanded entries (${EXTRA_OTHER_ITEM_IDS.size} allowed extra other_items id), ${Object.keys(parsed.map.d1_tables).length} D1 tables`,
  );
}

main();
