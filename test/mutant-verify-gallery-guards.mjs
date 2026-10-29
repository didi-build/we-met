#!/usr/bin/env node
/**
 * Mutant checks for gallery guard regression paths (DIDI-948 QA).
 * Exits non-zero if any claimed kill survives mutation.
 */
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";

const REPO_ROOT = join(import.meta.dirname, "..");
const LIB = join(REPO_ROOT, "scripts/lib/check-gallery-guards-lib.mjs");
const FIXTURES = join(REPO_ROOT, "test/fixtures/gallery-guards");

/** @param {string} source */
function extractJsWithoutSingleQuotePattern(source) {
  const bodies = [];
  const patterns = [/"(?:\\.|[^"\\])*"/g, /`(?:\\.|[^`\\]|\\$\{(?:\\.|[^}\\])*\})*`/g];
  for (const pattern of patterns) {
    let match = pattern.exec(source);
    while (match) {
      bodies.push(match[0].slice(1, -1));
      match = pattern.exec(source);
    }
  }
  return bodies;
}

/**
 * @param {string} mutatedSource
 * @param {string} importPath
 */
async function importMutatedLib(mutatedSource, importPath) {
  copyFileSync(
    join(REPO_ROOT, "scripts/lib/parse-jsonc.mjs"),
    join(dirname(importPath), "parse-jsonc.mjs"),
  );
  writeFileSync(importPath, mutatedSource);
  return import(pathToFileURL(importPath).href);
}

const libSource = readFileSync(LIB, "utf8");
const tmp = mkdtempSync(join(tmpdir(), "gallery-guard-mutant-"));
const mutatedPath = join(tmp, "check-gallery-guards-lib.mjs");

try {
  const singleQuoteFixture = readFileSync(
    join(FIXTURES, "bad-js-single-quote-preview.mjs"),
    "utf8",
  );
  if (singleQuoteFixture.includes('"npx wrangler preview')) {
    console.error(
      "bad-js-single-quote-preview.mjs must not use double-quoted preview command",
    );
    process.exit(1);
  }
  const libReal = await importMutatedLib(libSource, join(tmp, "lib-real.mjs"));
  const fullBodies = libReal.extractJsStringLiteralBodies(singleQuoteFixture);
  if (!fullBodies.some((body) => body.includes("wrangler preview"))) {
    console.error("single-quote fixture must be detected with full string extractors");
    process.exit(1);
  }
  const withoutSingle = extractJsWithoutSingleQuotePattern(singleQuoteFixture);
  if (withoutSingle.some((body) => body.includes("wrangler preview"))) {
    console.error(
      "single-quote fixture must not be visible to double-quote-only extract",
    );
    process.exit(1);
  }
  const libNoSingle = libSource.replace("    /'(?:\\\\.|[^'\\\\])*'/g,\n", "");
  const modNoSingle = await importMutatedLib(
    libNoSingle,
    join(tmp, "lib-no-single.mjs"),
  );
  const bodiesNoSingle = modNoSingle.extractJsStringLiteralBodies(singleQuoteFixture);
  if (bodiesNoSingle.some((body) => body.includes("wrangler preview"))) {
    console.error(
      "mutant single-quote (~:125): pattern removal still extracts preview",
    );
    process.exit(1);
  }
  if (
    modNoSingle.collectGalleryPreviewLocationViolations(
      singleQuoteFixture,
      "scripts/evil.mjs",
    ).length > 0
  ) {
    console.error(
      "mutant single-quote (~:125): location guard still flags without single-quote scan",
    );
    process.exit(1);
  }

  const libNo1160 = libSource.replace(
    'unknownGlobals.length > 0 &&\n        failClosedSegmentHasWranglerSubcommand(segmentFromMatch, "preview")',
    'false && unknownGlobals.length > 0 &&\n        failClosedSegmentHasWranglerSubcommand(segmentFromMatch, "preview")',
  );
  const modNo1160 = await importMutatedLib(libNo1160, mutatedPath);
  const mismatchedYaml = readFileSync(
    join(FIXTURES, "bad-workflow-mismatched-quote-unknown-global.yml"),
    "utf8",
  );
  const wfNo1160 = modNo1160.collectGalleryWorkflowViolations(mismatchedYaml);
  if (wfNo1160.some((e) => e.includes("global flag --x-provision"))) {
    console.error("mutant ~:1160: unknownGlobals fallback still active after mutation");
    process.exit(1);
  }

  const wfOk = libReal.collectGalleryWorkflowViolations(mismatchedYaml);
  if (!wfOk.some((e) => e.includes("global flag --x-provision"))) {
    console.error("1160 path: expected --x-provision global flag violation");
    process.exit(1);
  }

  console.log("gallery-guard mutants: all checked paths verified");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
