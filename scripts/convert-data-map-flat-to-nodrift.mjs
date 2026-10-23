/**
 * One-time helper: convert legacy flat data-map list YAML to nodrift schema_version 1.
 * Not used in CI; kept for reproducibility. Equivalence is enforced by test/nodrift/data-map-equivalence.test.ts.
 */
import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";

const FIELD_KEYS = [
  "whose",
  "data",
  "purpose",
  "storage",
  "processors",
  "retention",
  "who_can_see",
  "source",
  "verified",
  "notes",
];

function stableJson(value) {
  return JSON.stringify(value);
}

function computeDefaults(columns) {
  const defaults = {};
  for (const key of FIELD_KEYS) {
    const present = columns.filter((c) => c[key] !== undefined);
    if (present.length !== columns.length) {
      continue;
    }
    const first = present[0][key];
    if (present.every((c) => stableJson(c[key]) === stableJson(first))) {
      defaults[key] = first;
    }
  }
  return defaults;
}

function columnOverride(entry, defaults) {
  const override = {};
  for (const key of FIELD_KEYS) {
    if (entry[key] === undefined) {
      continue;
    }
    if (!(key in defaults) || stableJson(entry[key]) !== stableJson(defaults[key])) {
      override[key] = entry[key];
    }
  }
  return override;
}

function bindingForOtherItem(id) {
  if (id === "storage.r2.card_photo") {
    return "WE_MET_ASSETS";
  }
  if (
    id === "queue.visitor_followup" ||
    id === "queue.lead_sink_record" ||
    id === "queue.lead_sink_append_details"
  ) {
    return "WE_MET_FOLLOWUP_EMAIL_QUEUE";
  }
  if (id === "binding.worker_assets") {
    return "ASSETS";
  }
  if (id === "binding.worker_images") {
    return "IMAGES";
  }
  if (id === "binding.worker_self_reference") {
    return "WORKER_SELF_REFERENCE";
  }
  if (id === "storage.nonprod_environment") {
    return ["WE_MET_DB", "WE_MET_ASSETS", "WE_MET_FOLLOWUP_EMAIL_QUEUE"];
  }
  return undefined;
}

export function convertFlatDataMap(flatEntries) {
  if (!Array.isArray(flatEntries)) {
    throw new Error("flat data map must be a YAML list");
  }

  const d1Entries = flatEntries.filter((e) => e.table && e.column);
  const otherFlat = flatEntries.filter((e) => !e.table || !e.column);

  const byTable = new Map();
  for (const entry of d1Entries) {
    if (!byTable.has(entry.table)) {
      byTable.set(entry.table, []);
    }
    byTable.get(entry.table).push(entry);
  }

  const d1_tables = {};
  for (const [tableName, columns] of [...byTable.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const defaults = computeDefaults(columns);
    const columnMap = {};
    for (const entry of columns.sort((a, b) => a.column.localeCompare(b.column))) {
      columnMap[entry.column] = columnOverride(entry, defaults);
    }
    d1_tables[tableName] = {
      ...(Object.keys(defaults).length > 0 ? { defaults } : {}),
      columns: columnMap,
    };
  }

  const other_items = otherFlat
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((entry) => {
      const item = { id: entry.id };
      const binding = bindingForOtherItem(entry.id);
      if (binding !== undefined) {
        item.binding = binding;
      }
      for (const key of FIELD_KEYS) {
        if (entry[key] !== undefined) {
          item[key] = entry[key];
        }
      }
      if (entry.storage !== undefined && item.storage === undefined) {
        item.storage = entry.storage;
      }
      return item;
    });

  return {
    schema_version: 1,
    d1_tables,
    other_items,
  };
}

function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!inputPath || !outputPath) {
    console.error(
      "usage: node scripts/convert-data-map-flat-to-nodrift.mjs <flat.yml> <out.yml>",
    );
    process.exit(2);
  }
  const flat = yaml.parse(fs.readFileSync(inputPath, "utf8"));
  const grouped = convertFlatDataMap(flat);
  const doc = new yaml.Document(grouped);
  fs.writeFileSync(outputPath, String(doc));
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  main();
}
