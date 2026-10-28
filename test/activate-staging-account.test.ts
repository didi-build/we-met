import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACTIVATION_D1_DATABASE_NAME,
  assertWranglerConfigTargetsNonprodD1,
  buildActivationUpdateCommand,
  validateActivationEmail,
} from "../scripts/lib/activate-staging-account.mjs";

describe("validateActivationEmail (unit)", () => {
  it("accepts typical maintainer emails", () => {
    expect(validateActivationEmail("diadem@didi.build")).toEqual({
      ok: true,
      normalized: "diadem@didi.build",
    });
    expect(validateActivationEmail("user.name+tag@example.co.uk")).toMatchObject({
      ok: true,
      normalized: "user.name+tag@example.co.uk",
    });
  });

  it("normalizes to lowercase", () => {
    expect(validateActivationEmail("User@Example.COM")).toEqual({
      ok: true,
      normalized: "user@example.com",
    });
  });

  it("rejects empty and non-strings", () => {
    expect(validateActivationEmail("")).toMatchObject({ ok: false });
    expect(validateActivationEmail("   ")).toMatchObject({ ok: false });
    expect(validateActivationEmail(null)).toMatchObject({ ok: false });
  });

  it("rejects SQL injection and shell metacharacters", () => {
    const bad = [
      "foo'; DROP TABLE accounts;--",
      "foo@bar.com; DELETE FROM accounts",
      'foo"@example.com',
      "foo'@example.com",
      "foo bar@example.com",
      "foo\\@example.com",
      "foo@example.com--",
      "foo@example.com/*",
      "*/foo@example.com",
    ];
    for (const email of bad) {
      expect(validateActivationEmail(email).ok, email).toBe(false);
    }
  });

  it("rejects addresses outside the conservative pattern", () => {
    expect(validateActivationEmail("not-an-email").ok).toBe(false);
    expect(validateActivationEmail("@example.com").ok).toBe(false);
    expect(validateActivationEmail("user@").ok).toBe(false);
    expect(validateActivationEmail("user@@example.com").ok).toBe(false);
    expect(validateActivationEmail("user@example").ok).toBe(false);
  });
});

describe("assertWranglerConfigTargetsNonprodD1 (unit)", () => {
  function writeConfig(name: string, d1Name: string) {
    const dir = mkdtempSync(join(tmpdir(), "activate-staging-guard-"));
    const path = join(dir, name);
    writeFileSync(
      path,
      JSON.stringify(
        {
          d1_databases: [
            {
              binding: "WE_MET_DB",
              database_name: d1Name,
              database_id: "00000000-0000-0000-0000-000000000002",
            },
          ],
        },
        null,
        2,
      ),
    );
    return path;
  }

  it("accepts we-met-db-nonprod", () => {
    const path = writeConfig("ok.jsonc", ACTIVATION_D1_DATABASE_NAME);
    expect(assertWranglerConfigTargetsNonprodD1(path)).toEqual({ ok: true });
  });

  it("refuses production we-met-db", () => {
    const path = writeConfig("prod.jsonc", "we-met-db");
    const result = assertWranglerConfigTargetsNonprodD1(path);
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) {
      expect(result.reason).toContain("we-met-db");
    }
  });

  it("refuses other database names", () => {
    const path = writeConfig("other.jsonc", "some-other-db");
    const result = assertWranglerConfigTargetsNonprodD1(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain(ACTIVATION_D1_DATABASE_NAME);
    }
  });
});

describe("buildActivationUpdateCommand (unit)", () => {
  it("embeds validated email and timestamp in UPDATE", () => {
    const sql = buildActivationUpdateCommand(
      "diadem@didi.build",
      "2026-10-28T12:00:00.000Z",
    );
    expect(sql).toContain("UPDATE accounts");
    expect(sql).toContain("status = 'active'");
    expect(sql).toContain("updated_at = '2026-10-28T12:00:00.000Z'");
    expect(sql).toContain("email = 'diadem@didi.build'");
    expect(sql).toContain("waitlisted");
  });
});

describe("Activate staging account workflow structure (unit)", () => {
  const workflow = readFileSync(
    ".github/workflows/activate-staging-account.yml",
    "utf8",
  );

  it("only triggers on workflow_dispatch", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/^\s+pull_request:/m);
    expect(workflow).not.toMatch(/^\s+pull_request_target:/m);
    expect(workflow).not.toMatch(/^\s+push:/m);
  });

  it("requires main ref and checks out main", () => {
    expect(workflow).toContain("github.ref == 'refs/heads/main'");
    expect(workflow).toContain("ref: main");
    expect(workflow).toContain("refs/heads/main");
  });

  it("uses staging environment and activation script", () => {
    expect(workflow).toMatch(/environment:\s*staging/m);
    expect(workflow).toContain("activate-staging-account.mjs");
    expect(workflow).toContain("CLOUDFLARE_API_TOKEN_STAGING");
    expect(workflow).toContain("secrets.WE_MET_D1_DATABASE_ID_NONPROD");
    expect(workflow).not.toContain("vars.WE_MET_D1_DATABASE_ID_NONPROD");
    expect(workflow).toContain("ACTIVATE_EMAIL:");
  });

  it("does not interpolate workflow inputs inside run scripts", () => {
    const runBlocks =
      workflow.match(/run:\s*\|[\s\S]*?(?=\n\s{6}\S|\n\s{4}\S|$)/g) ?? [];
    const runLines = workflow.match(/^\s+run:\s+[^\n|]+$/gm) ?? [];
    for (const block of [...runBlocks, ...runLines]) {
      expect(block).not.toMatch(/\$\{\{\s*inputs\./);
    }
  });
});

describe("activate-staging-account logging (unit)", () => {
  it("masks email before D1 execute and avoids echoing it in user messages", () => {
    const script = readFileSync("scripts/activate-staging-account.mjs", "utf8");
    expect(script).toContain("maskActivationEmailForLogs");
    expect(script).toContain('console.log("Staging account activation succeeded.")');
    expect(script).toContain(
      "Staging account activation failed: account not found or not waitlisted.",
    );
    expect(script).not.toMatch(/console\.(log|error)\([^)]*normalized/);
    expect(script).not.toMatch(/console\.(log|error)\([^)]*\$\{.*email/i);
  });
});
