import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function collectTsSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...collectTsSourceFiles(full));
      continue;
    }
    if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      files.push(full);
    }
  }
  return files;
}

describe("follow-up consumer D1 boundary (static)", () => {
  it("touches D1 only through the ledger module and never references lead_sinks or cards", () => {
    const consumerDir = join(process.cwd(), "src/followup-email-consumer");
    const ledgerFile = join(consumerDir, "lead-delivery-ledger.ts");
    const ledgerSource = readFileSync(ledgerFile, "utf8");
    expect(ledgerSource).toContain("prepare(");

    for (const file of collectTsSourceFiles(consumerDir)) {
      if (file === ledgerFile) {
        continue;
      }
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/\bprepare\s*\(/);
      expect(source).not.toContain("lead_sinks");
      expect(source).not.toMatch(/\bcards\b/);
    }
  });
});
