import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACTIVATION_D1_DATABASE_NAME,
  assertWranglerConfigTargetsNonprodD1,
  buildActivationUpdateCommand,
  buildWranglerD1ExecuteArgv,
  emailAppearsOnlyInWhereLiteral,
  parseWranglerD1ExecuteRowChanges,
  resolveActivationRowOutcome,
  validateActivationEmail,
  WRANGLER_D1_EXECUTE_SPAWN_OPTIONS,
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
  const iso = "2026-10-28T12:00:00.000Z";
  const email = "diadem@didi.build";

  it("embeds validated email and timestamp in UPDATE", () => {
    const sql = buildActivationUpdateCommand(email, iso);
    expect(sql).toContain("UPDATE accounts");
    expect(sql).toContain("status = 'active'");
    expect(sql).toContain("updated_at = '2026-10-28T12:00:00.000Z'");
    expect(sql).toContain("email = 'diadem@didi.build'");
    expect(sql).toContain("waitlisted");
    expect(sql).toContain("active");
  });

  it("places email only in the WHERE string literal", () => {
    const sql = buildActivationUpdateCommand(email, iso);
    expect(emailAppearsOnlyInWhereLiteral(sql, email)).toBe(true);
  });
});

describe("wrangler D1 execute argv (unit)", () => {
  it("uses shell: false and passes SQL as one argv element", () => {
    expect(WRANGLER_D1_EXECUTE_SPAWN_OPTIONS.shell).toBe(false);
    const sql = buildActivationUpdateCommand(
      "user@example.com",
      "2026-10-28T12:00:00.000Z",
    );
    const argv = buildWranglerD1ExecuteArgv("wrangler.staging.ci.jsonc", sql);
    const commandFlagIndex = argv.indexOf("--command");
    expect(commandFlagIndex).toBeGreaterThan(-1);
    expect(argv[commandFlagIndex + 1]).toBe(sql);
    expect(argv.filter((part) => part === sql)).toHaveLength(1);
  });
});

describe("parseWranglerD1ExecuteRowChanges (unit)", () => {
  it("reads meta.changes from wrangler JSON stdout", () => {
    expect(
      parseWranglerD1ExecuteRowChanges(JSON.stringify([{ meta: { changes: 1 } }])),
    ).toBe(1);
    expect(
      parseWranglerD1ExecuteRowChanges(JSON.stringify([{ meta: { changes: 0 } }])),
    ).toBe(0);
    expect(
      parseWranglerD1ExecuteRowChanges(JSON.stringify([{ meta: { changes: 2 } }])),
    ).toBe(2);
  });

  it("returns null when stdout is not parseable", () => {
    expect(parseWranglerD1ExecuteRowChanges("not json")).toBeNull();
    expect(parseWranglerD1ExecuteRowChanges("{}")).toBeNull();
    expect(parseWranglerD1ExecuteRowChanges("[]")).toBeNull();
  });
});

describe("resolveActivationRowOutcome (unit)", () => {
  it("accepts exactly one changed row", () => {
    expect(resolveActivationRowOutcome(1)).toBe("success");
  });

  it("rejects zero, multiple, and unparseable counts", () => {
    expect(resolveActivationRowOutcome(0)).toBe("not_found");
    expect(resolveActivationRowOutcome(2)).toBe("ambiguous");
    expect(resolveActivationRowOutcome(null)).toBe("unparseable");
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

  it("limits permissions to contents read", () => {
    expect(workflow).toContain("permissions:");
    expect(workflow).toContain("contents: read");
    expect(workflow).not.toContain("contents: write");
    expect(workflow).not.toContain("id-token: write");
  });

  it("requires main ref, staging environment, and main checkout", () => {
    const job = workflow.match(/^  activate:[\s\S]*$/m)?.[0] ?? "";
    expect(job).toContain("if: github.ref == 'refs/heads/main'");
    expect(job).toContain("environment: staging");
    expect(workflow).toContain("ref: main");
    expect(workflow).toContain("refs/heads/main");
  });

  it("uses staging credentials and activation script", () => {
    expect(workflow).toContain("activate-staging-account.mjs");
    expect(workflow).toContain("CLOUDFLARE_API_TOKEN_STAGING");
    expect(workflow).toContain("secrets.WE_MET_D1_DATABASE_ID_NONPROD");
    expect(workflow).not.toContain("vars.WE_MET_D1_DATABASE_ID_NONPROD");
    expect(workflow).toContain("ACTIVATE_EMAIL:");
  });

  it("does not reference production resources", () => {
    expect(workflow).not.toContain("CLOUDFLARE_API_TOKEN_PRODUCTION");
    expect(workflow).not.toMatch(/environment:\s*production/m);
    expect(workflow.replace(/we-met-db-nonprod/g, "")).not.toContain("we-met-db");
  });

  it("does not write a job summary", () => {
    expect(workflow).not.toContain("GITHUB_STEP_SUMMARY");
  });

  it("does not interpolate workflow inputs or secrets inside run scripts", () => {
    const runBlocks =
      workflow.match(/run:\s*\|[\s\S]*?(?=\n\s{6}\S|\n\s{4}\S|$)/g) ?? [];
    const runLines = workflow.match(/^\s+run:\s+[^\n|]+$/gm) ?? [];
    for (const block of [...runBlocks, ...runLines]) {
      expect(block).not.toMatch(/\$\{\{\s*inputs\./);
      expect(block).not.toMatch(/\$\{\{\s*secrets\./);
    }
  });

  it("masks D1 id in run output only via add-mask", () => {
    const runBlocks =
      workflow.match(/run:\s*\|[\s\S]*?(?=\n\s{6}\S|\n\s{4}\S|$)/g) ?? [];
    for (const block of runBlocks) {
      if (block.includes("WE_MET_D1_DATABASE_ID_NONPROD")) {
        expect(block).toMatch(/::add-mask::\$\{WE_MET_D1_DATABASE_ID_NONPROD\}/);
        expect(block).not.toMatch(/echo\s+\$\{WE_MET_D1_DATABASE_ID_NONPROD\}/);
      }
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
    expect(script).toContain(
      "Staging account activation failed: multiple accounts matched.",
    );
    expect(script).toContain(
      "Staging account activation failed: could not verify activation result.",
    );
    expect(script).not.toMatch(/console\.(log|error)\([^)]*normalized/);
    expect(script).not.toMatch(/console\.(log|error)\([^)]*\$\{.*email/i);
    expect(script).not.toMatch(/stderr\.write\(result\.stderr/);
    expect(script).not.toMatch(/console\.(log|error)\([^)]*result\.stdout/);
    expect(script).toContain("WRANGLER_D1_EXECUTE_SPAWN_OPTIONS");
    expect(script).not.toMatch(/shell:\s*true/);
  });

  it("masks operator email only through add-mask helper", () => {
    const lib = readFileSync("scripts/lib/activate-staging-account.mjs", "utf8");
    expect(lib).toMatch(
      /maskActivationEmailForLogs[\s\S]*console\.log\(`::add-mask::\$\{email\}`\)/,
    );
  });
});
