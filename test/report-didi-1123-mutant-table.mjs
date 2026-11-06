/**
 * One-off report for DIDI-1123: applies each listed mutant to scripts/lib/privileged-paths.mjs,
 * runs the full Vitest suite (`npm run test`), restores the file, and prints a markdown table.
 *
 * Usage (from repo root): node test/report-didi-1123-mutant-table.mjs
 *
 * Do not add this script to CI; the ticket needs an honest table from a full-suite run.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const target = join(repoRoot, "scripts/lib/privileged-paths.mjs");

const GH_ORIGINAL = "    test: (filename) => filename === ghApiErrorsPath,";
const PARSE_ORIGINAL = "    test: (filename) => filename === parseJsoncPath,";

/** @type {{ id: string; matcher: "gh-api-errors" | "parse-jsonc"; label: string; line: string }[]} */
const mutants = [
  {
    id: "gh-endsWith",
    matcher: "gh-api-errors",
    label: "endsWith scripts/lib/gh-api-errors.mjs",
    line: `    test: (filename) => filename.endsWith("scripts/lib/gh-api-errors.mjs"),`,
  },
  {
    id: "gh-includes",
    matcher: "gh-api-errors",
    label: 'includes "gh-api-errors.mjs"',
    line: `    test: (filename) => filename.includes("gh-api-errors.mjs"),`,
  },
  {
    id: "gh-caseFold",
    matcher: "gh-api-errors",
    label: "case-insensitive compare to ghApiErrorsPath",
    line: `    test: (filename) => filename.toLowerCase() === ghApiErrorsPath.toLowerCase(),`,
  },
  {
    id: "gh-stripDotSlash",
    matcher: "gh-api-errors",
    label: "strip leading ./ then compare to ghApiErrorsPath",
    line: `    test: (filename) => filename.replace(/^\\.\\//, "") === ghApiErrorsPath,`,
  },
  {
    id: "gh-trimSlash",
    matcher: "gh-api-errors",
    label: "strip leading / then compare to ghApiErrorsPath",
    line: `    test: (filename) => filename.replace(/^\\//, "") === ghApiErrorsPath,`,
  },
  {
    id: "gh-startsWith",
    matcher: "gh-api-errors",
    label: 'startsWith "scripts/lib/gh-api-errors"',
    line: `    test: (filename) => filename.startsWith("scripts/lib/gh-api-errors"),`,
  },
  {
    id: "pj-endsWith",
    matcher: "parse-jsonc",
    label: "endsWith scripts/lib/parse-jsonc.mjs",
    line: `    test: (filename) => filename.endsWith("scripts/lib/parse-jsonc.mjs"),`,
  },
  {
    id: "pj-includes",
    matcher: "parse-jsonc",
    label: 'includes "parse-jsonc.mjs"',
    line: `    test: (filename) => filename.includes("parse-jsonc.mjs"),`,
  },
  {
    id: "pj-caseFold",
    matcher: "parse-jsonc",
    label: "case-insensitive compare to parseJsoncPath",
    line: `    test: (filename) => filename.toLowerCase() === parseJsoncPath.toLowerCase(),`,
  },
  {
    id: "pj-stripDotSlash",
    matcher: "parse-jsonc",
    label: "strip leading ./ then compare to parseJsoncPath",
    line: `    test: (filename) => filename.replace(/^\\.\\//, "") === parseJsoncPath,`,
  },
  {
    id: "pj-trimSlash",
    matcher: "parse-jsonc",
    label: "strip leading / then compare to parseJsoncPath",
    line: `    test: (filename) => filename.replace(/^\\//, "") === parseJsoncPath,`,
  },
  {
    id: "pj-startsWith",
    matcher: "parse-jsonc",
    label: 'startsWith "scripts/lib/parse-jsonc"',
    line: `    test: (filename) => filename.startsWith("scripts/lib/parse-jsonc"),`,
  },
];

const killingSuite = "`npm run test` (full suite)";
const killingTestsGh =
  "test/privileged-paths.test.ts (privilege matcher gh-api-errors near-miss (DIDI-1123))";
const killingTestsPj =
  "test/privileged-paths.test.ts (privilege matcher parse-jsonc near-miss (DIDI-1123))";

function applyMutant(source, mutant) {
  const original = mutant.matcher === "gh-api-errors" ? GH_ORIGINAL : PARSE_ORIGINAL;
  if (!source.includes(original)) {
    throw new Error(
      `Expected line not found for ${mutant.matcher}: ${original.trim()} (file changed?)`,
    );
  }
  return source.replace(original, mutant.line);
}

const originalSource = readFileSync(target, "utf8");

console.log("| Mutant | Test that kills | Result |");
console.log("| --- | --- | --- |");

for (const m of mutants) {
  const mutated = applyMutant(originalSource, m);
  writeFileSync(target, mutated, "utf8");
  const r = spawnSync("npm", ["run", "test"], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    env: { ...process.env, CI: "true" },
  });
  writeFileSync(target, originalSource, "utf8");

  const killed = r.status !== 0;
  if (killed && r.stderr?.length) {
    process.stderr.write(
      `\n[${m.id}] npm run test failed (exit ${r.status}). stderr tail:\n${String(r.stderr).slice(-4000)}\n`,
    );
  }
  const killerTest = m.matcher === "gh-api-errors" ? killingTestsGh : killingTestsPj;
  const rowResult = killed ? "Killed" : "Survived";
  const escapedLabel = m.label.replace(/\|/g, "\\|");
  console.log(
    `| ${m.matcher}: ${escapedLabel} | ${killerTest}; ${killingSuite} | ${rowResult} |`,
  );
}
