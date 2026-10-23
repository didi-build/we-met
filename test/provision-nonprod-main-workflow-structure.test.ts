import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Provision non-prod main workflow structure (unit)", () => {
  const workflow = readFileSync(".github/workflows/provision-nonprod-main.yml", "utf8");

  it("runs on main push with wrangler path filter and workflow_dispatch", () => {
    expect(workflow).toContain("branches: [main]");
    expect(workflow).toContain("wrangler.jsonc");
    expect(workflow).toContain("workers/**/wrangler.*.jsonc");
    expect(workflow).toContain("workflow_dispatch");
  });

  it("uses migrate-nonprod environment and main checkout only", () => {
    expect(workflow).toMatch(/environment:\s*migrate-nonprod/m);
    expect(workflow).toContain("ref: main");
    expect(workflow).toContain("CLOUDFLARE_API_TOKEN_MIGRATE_NONPROD");
    expect(workflow).toContain("--target nonprod");
  });

  it("shares migrate-nonprod apply concurrency", () => {
    expect(workflow).toContain("group: migrate-nonprod-apply");
    expect(workflow).toContain("cancel-in-progress: false");
  });
});
