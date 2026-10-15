#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildGeneratedEmailTemplatesSource } from "./generate-email-templates.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const generatedPath = join(repoRoot, "src/email/templates/generated.ts");

const onDisk = readFileSync(generatedPath, "utf8");
const expected = buildGeneratedEmailTemplatesSource();

if (onDisk !== expected) {
  console.error(
    "src/email/templates/generated.ts is out of date. Run: npm run email-templates:generate",
  );
  process.exit(1);
}

console.log("email templates generated module is up to date");
