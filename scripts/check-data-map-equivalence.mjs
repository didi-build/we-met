import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "yaml";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nodriftApi = path.join(
  repoRoot,
  "node_modules/@didi-build/nodrift/dist/index.js",
);
const { expandDataMap, parseDataMap } = await import(
  new URL(`file://${nodriftApi}`).href
);

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
  const flatPath = path.join(repoRoot, "test/fixtures/data-map-flat-pre-nodrift.yml");
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
  if (expanded.length !== flat.length) {
    console.error(
      `entry count mismatch: flat=${flat.length} expanded=${expanded.length}`,
    );
    process.exit(1);
  }

  const byId = new Map(expanded.map((e) => [e.id, expandedPlain(e)]));
  const mismatches = [];
  for (const flatEntry of flat) {
    const expected = pickKeptFields(flatEntry);
    const actual = byId.get(flatEntry.id);
    if (!actual) {
      mismatches.push(`missing expanded entry for ${flatEntry.id}`);
      continue;
    }
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      mismatches.push(`${flatEntry.id}`);
    }
  }

  if (mismatches.length > 0) {
    console.error(
      `data map equivalence failed for ${mismatches.length} entries (first 5): ${mismatches.slice(0, 5).join(", ")}`,
    );
    process.exit(1);
  }

  console.log(
    `data-map equivalence ok: ${flat.length} entries, ${Object.keys(parsed.map.d1_tables).length} D1 tables`,
  );
}

main();
