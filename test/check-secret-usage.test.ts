import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  findBootstrapTokenViolations,
  findConsumerProductionCredentialViolations,
  findMigrateNonprodCredentialViolations,
  findStagingCredentialViolations,
  findPreviewCredentialViolations,
  findLegacyPreviewNonprodCredentialViolations,
} from "../scripts/check-secret-usage.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const cliScript = join(root, "scripts/check-secret-usage.mjs");

function runCli(cwd: string) {
  try {
    execFileSync("node", [cliScript], { cwd, encoding: "utf8", stdio: "pipe" });
    return { status: 0, stderr: "", stdout: "" };
  } catch (err: unknown) {
    const e = err as { status?: number; stderr?: string; stdout?: string };
    return {
      status: e.status ?? 1,
      stderr: e.stderr ?? "",
      stdout: e.stdout ?? "",
    };
  }
}

describe("check-secret-usage (unit)", () => {
  it("allows BOOTSTRAP_TOKEN only in bootstrap.yml", () => {
    const dir = mkdtempSync(join(tmpdir(), "secret-usage-"));
    writeFileSync(
      join(dir, "bootstrap.yml"),
      "token: ${{ secrets.BOOTSTRAP_TOKEN }}\n",
    );
    writeFileSync(join(dir, "ci.yml"), "permissions:\n  contents: read\n");
    expect(findBootstrapTokenViolations(dir)).toEqual([]);

    writeFileSync(join(dir, "evil.yml"), "secrets.BOOTSTRAP_TOKEN\n");
    expect(findBootstrapTokenViolations(dir)).toEqual(["evil.yml"]);
  });

  it("allows staging token only in deploy-staging.yml", () => {
    const dir = mkdtempSync(join(tmpdir(), "secret-usage-staging-"));
    writeFileSync(
      join(dir, "deploy-staging.yml"),
      "secrets.CLOUDFLARE_API_TOKEN_STAGING\n",
    );
    writeFileSync(join(dir, "ci.yml"), "name: CI\n");
    expect(findStagingCredentialViolations(dir)).toEqual([]);

    writeFileSync(join(dir, "leak.yml"), "CLOUDFLARE_API_TOKEN_STAGING\n");
    expect(findStagingCredentialViolations(dir)).toEqual(["leak.yml"]);
  });

  it("allows consumer production token only in deploy-production.yml", () => {
    const dir = mkdtempSync(join(tmpdir(), "secret-usage-consumer-"));
    writeFileSync(
      join(dir, "deploy-production.yml"),
      "secrets.CLOUDFLARE_API_TOKEN_CONSUMER_PRODUCTION\n",
    );
    writeFileSync(join(dir, "ci.yml"), "name: CI\n");
    expect(findConsumerProductionCredentialViolations(dir)).toEqual([]);

    writeFileSync(join(dir, "leak.yml"), "CLOUDFLARE_API_TOKEN_CONSUMER_PRODUCTION\n");
    expect(findConsumerProductionCredentialViolations(dir)).toEqual(["leak.yml"]);
  });

  it("allows migrate-nonprod secret only in migrate-nonprod.yml and provision-nonprod-main.yml", () => {
    const dir = mkdtempSync(join(tmpdir(), "secret-usage-migrate-"));
    writeFileSync(
      join(dir, "migrate-nonprod.yml"),
      "environment: migrate-nonprod\nsecrets.CLOUDFLARE_API_TOKEN_MIGRATE_NONPROD\n",
    );
    writeFileSync(
      join(dir, "provision-nonprod-main.yml"),
      "environment: migrate-nonprod\nsecrets.CLOUDFLARE_API_TOKEN_MIGRATE_NONPROD\n",
    );
    writeFileSync(join(dir, "ci.yml"), "name: CI\n");
    expect(findMigrateNonprodCredentialViolations(dir)).toEqual([]);

    writeFileSync(join(dir, "leak.yml"), "migrate-nonprod\n");
    expect(findMigrateNonprodCredentialViolations(dir)).toEqual(["leak.yml"]);
  });

  it("rejects legacy CLOUDFLARE_API_TOKEN_NONPROD in any workflow", () => {
    const dir = mkdtempSync(join(tmpdir(), "secret-usage-legacy-preview-"));
    writeFileSync(join(dir, "preview.yml"), "CLOUDFLARE_API_TOKEN_PREVIEW\n");
    expect(findLegacyPreviewNonprodCredentialViolations(dir)).toEqual([]);

    writeFileSync(join(dir, "old.yml"), "CLOUDFLARE_API_TOKEN_NONPROD\n");
    expect(findLegacyPreviewNonprodCredentialViolations(dir)).toEqual(["old.yml"]);
  });

  it("allows preview token only in preview.yml and gallery-preview.yml", () => {
    const dir = mkdtempSync(join(tmpdir(), "secret-usage-preview-"));
    writeFileSync(join(dir, "preview.yml"), "secrets.CLOUDFLARE_API_TOKEN_PREVIEW\n");
    writeFileSync(
      join(dir, "gallery-preview.yml"),
      "secrets.CLOUDFLARE_API_TOKEN_PREVIEW\n",
    );
    writeFileSync(join(dir, "ci.yml"), "name: CI\n");
    expect(findPreviewCredentialViolations(dir)).toEqual([]);

    writeFileSync(join(dir, "leak.yml"), "CLOUDFLARE_API_TOKEN_PREVIEW\n");
    expect(findPreviewCredentialViolations(dir)).toEqual(["leak.yml"]);
  });

  it("returns no violations when the workflows directory is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "secret-usage-missing-"));
    expect(findBootstrapTokenViolations(join(dir, ".github/workflows"))).toEqual([]);
  });
});

describe("check-secret-usage CLI (subprocess)", () => {
  it("exits 0 when .github/workflows is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "secret-usage-cli-missing-"));
    expect(runCli(dir).status).toBe(0);
  });

  it("exits 0 when workflows are clean", () => {
    const dir = mkdtempSync(join(tmpdir(), "secret-usage-cli-clean-"));
    const workflows = join(dir, ".github/workflows");
    mkdirSync(workflows, { recursive: true });
    writeFileSync(join(workflows, "bootstrap.yml"), "token: ok\n");
    writeFileSync(join(workflows, "ci.yml"), "name: CI\n");
    expect(runCli(dir).status).toBe(0);
  });

  it("exits 1 when a non-bootstrap workflow mentions BOOTSTRAP_TOKEN", () => {
    const dir = mkdtempSync(join(tmpdir(), "secret-usage-cli-fail-"));
    const workflows = join(dir, ".github/workflows");
    mkdirSync(workflows, { recursive: true });
    writeFileSync(join(workflows, "bootstrap.yml"), "token: ok\n");
    writeFileSync(join(workflows, "leak.yml"), "secrets.BOOTSTRAP_TOKEN\n");
    const result = runCli(dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("leak.yml");
  });
});
