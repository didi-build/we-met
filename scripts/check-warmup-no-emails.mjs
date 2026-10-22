#!/usr/bin/env node
/**
 * Fails if a non-placeholder email appears under workers/warmup/.
 * Allows @example.com (and subdomains) only.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "workers/warmup";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function isAllowedEmail(email) {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return domain === "example.com" || domain.endsWith(".example.com");
}

function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) out.push(...listFiles(path));
    else if (st.isFile()) out.push(path);
  }
  return out;
}

const offenders = [];
for (const file of listFiles(ROOT)) {
  const text = readFileSync(file, "utf8");
  const matches = [...text.matchAll(EMAIL_RE)].map((m) => m[0]);
  for (const email of matches) {
    if (!isAllowedEmail(email)) {
      offenders.push({ file, email });
    }
  }
}

if (offenders.length > 0) {
  console.error("Non-placeholder email addresses found under workers/warmup/:\n");
  for (const { file, email } of offenders) {
    console.error(`  ${file}: ${email}`);
  }
  console.error(
    "\nUse example.com placeholders only, or read addresses from Wrangler secrets.",
  );
  process.exit(1);
}

console.log("check-warmup-no-emails: ok");
