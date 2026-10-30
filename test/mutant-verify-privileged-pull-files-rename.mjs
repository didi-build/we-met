#!/usr/bin/env node
/**
 * Mutant checks for privileged pull rename matching (DIDI-968).
 * Exits non-zero if any claimed kill survives mutation.
 */
import { readFileSync, rmSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const REPO_ROOT = join(import.meta.dirname, "..");
const LIB = join(REPO_ROOT, "scripts/lib/privileged-pull-files-api.mjs");
const RENAME_OUT_FIXTURE = join(
  REPO_ROOT,
  "test/fixtures/privileged-pull-files-api/rename-privileged-to-unlisted.json",
);

/** @typedef {import("../scripts/lib/privileged-pull-files-api.mjs").PullRequestChangedFile} PullRequestChangedFile */

/** @type {(file: PullRequestChangedFile) => boolean} */
function isPrivilegedPathForMutant(filename) {
  return filename === "wrangler.jsonc" || filename.startsWith(".github/");
}

/** @type {PullRequestChangedFile} */
const renameOutOfPrivileged = {
  filename: "docs/runbooks/renamed-wrangler-note.md",
  status: "renamed",
  previous_filename: "wrangler.jsonc",
};

/** @type {PullRequestChangedFile} */
const renameIntoPrivileged = {
  filename: "wrangler.jsonc",
  status: "renamed",
  previous_filename: "docs/runbooks/renamed-wrangler-note.md",
};

/**
 * @param {string} mutatedSource
 * @param {string} importPath
 */
async function importMutatedLib(mutatedSource, importPath) {
  writeFileSync(importPath, mutatedSource);
  return import(pathToFileURL(importPath).href);
}

/**
 * @param {typeof import("../scripts/lib/privileged-pull-files-api.mjs")} mod
 */
function assertRenameOutCaught(mod) {
  const files = mod.privilegedFilenamesFromChangedFiles(
    [renameOutOfPrivileged],
    isPrivilegedPathForMutant,
  );
  if (!files.includes("wrangler.jsonc")) {
    console.error("real: rename out of privileged path was not flagged");
    process.exit(1);
  }
}

/**
 * @param {typeof import("../scripts/lib/privileged-pull-files-api.mjs")} mod
 */
function assertRenameInCaught(mod) {
  const files = mod.privilegedFilenamesFromChangedFiles(
    [renameIntoPrivileged],
    isPrivilegedPathForMutant,
  );
  if (!files.includes("wrangler.jsonc")) {
    console.error("real: rename into privileged path was not flagged");
    process.exit(1);
  }
}

const libSource = readFileSync(LIB, "utf8");
const tmp = mkdtempSync(join(tmpdir(), "privileged-pull-rename-mutant-"));

try {
  const real = await importMutatedLib(libSource, join(tmp, "lib-real.mjs"));
  assertRenameOutCaught(real);
  assertRenameInCaught(real);

  const dropPreviousFilename = libSource.replace(
    `  if (
    record.status === "renamed" &&
    typeof record.previous_filename === "string" &&
    record.previous_filename.length > 0
  ) {
    normalized.previous_filename = record.previous_filename;
  }`,
    "",
  );
  const modDropPrevious = await importMutatedLib(
    dropPreviousFilename,
    join(tmp, "lib-drop-previous.mjs"),
  );
  const changedDropPrevious = modDropPrevious.parsePullRequestFilesApiStdout(
    readFileSync(RENAME_OUT_FIXTURE, "utf8"),
  );
  if (
    modDropPrevious.privilegedFilenamesFromChangedFiles(
      changedDropPrevious,
      isPrivilegedPathForMutant,
    ).length !== 0
  ) {
    console.error(
      "mutant drop previous_filename: rename-out test must fail (still flagged)",
    );
    process.exit(1);
  }

  const onlyNewPath = libSource.replace(
    `  if (
    file.status === "renamed" &&
    typeof file.previous_filename === "string" &&
    file.previous_filename.length > 0
  ) {
    paths.push(file.previous_filename);
  }`,
    "",
  );
  const modOnlyNew = await importMutatedLib(onlyNewPath, join(tmp, "lib-only-new.mjs"));
  if (
    modOnlyNew
      .privilegedFilenamesFromChangedFiles(
        [renameOutOfPrivileged],
        isPrivilegedPathForMutant,
      )
      .includes("wrangler.jsonc")
  ) {
    console.error("mutant only new path: rename-out kill did not fail tests");
    process.exit(1);
  }

  const onlyOldPath = libSource.replace(
    "  const paths = [file.filename];",
    "  const paths = [];",
  );
  const modOnlyOld = await importMutatedLib(onlyOldPath, join(tmp, "lib-only-old.mjs"));
  if (
    modOnlyOld
      .privilegedFilenamesFromChangedFiles(
        [renameIntoPrivileged],
        isPrivilegedPathForMutant,
      )
      .includes("wrangler.jsonc")
  ) {
    console.error("mutant only old path: rename-in kill did not fail tests");
    process.exit(1);
  }

  const invertedCondition = libSource.replace(
    "      if (isPrivilegedPathFn(path)) {",
    "      if (!isPrivilegedPathFn(path)) {",
  );
  const modInverted = await importMutatedLib(
    invertedCondition,
    join(tmp, "lib-inverted.mjs"),
  );
  if (
    modInverted
      .privilegedFilenamesFromChangedFiles(
        [renameOutOfPrivileged],
        isPrivilegedPathForMutant,
      )
      .includes("wrangler.jsonc")
  ) {
    console.error("mutant inverted condition: rename-out kill did not fail tests");
    process.exit(1);
  }
  if (
    modInverted
      .privilegedFilenamesFromChangedFiles(
        [renameIntoPrivileged],
        isPrivilegedPathForMutant,
      )
      .includes("wrangler.jsonc")
  ) {
    console.error("mutant inverted condition: rename-in kill did not fail tests");
    process.exit(1);
  }

  console.log("privileged-pull-files rename mutants: all checked paths verified");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
