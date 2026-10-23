/**
 * Negative proof for nodrift Check 2: an in-scope Wrangler binding not listed on the map must fail.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nodriftApi = path.join(
  repoRoot,
  "node_modules/@didi-build/nodrift/dist/index.js",
);
const { checkDataStoresVsMap } = await import(new URL(`file://${nodriftApi}`).href);

const wranglerDir = fs.mkdtempSync(path.join(os.tmpdir(), "nodrift-wrangler-"));
fs.writeFileSync(
  path.join(wranglerDir, "wrangler.jsonc"),
  JSON.stringify({
    name: "fixture",
    main: "index.ts",
    compatibility_date: "2026-01-01",
    kv_namespaces: [
      { binding: "UNMAPPED_KV_FIXTURE", id: "00000000-0000-0000-0000-000000000099" },
    ],
  }),
  "utf8",
);

const mapPath = path.join(repoRoot, "docs/privacy/data-map.yml");
const result = checkDataStoresVsMap({ mapFilePath: mapPath, wranglerDir });

fs.rmSync(wranglerDir, { recursive: true, force: true });

if (result.kind !== "findings") {
  console.error(`expected findings, got ${result.kind}`);
  process.exit(1);
}

const codes = result.findings.map((f) => f.code);
if (!codes.includes("binding_not_in_map")) {
  console.error(`expected binding_not_in_map, got ${codes.join(", ")}`);
  process.exit(1);
}

console.log("nodrift check 2 binding fixture ok");
