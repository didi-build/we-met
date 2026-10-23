import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  findVarsD1DatabaseIdReference,
  VARS_D1_DATABASE_ID_PATTERN,
} from "../scripts/check-workflow-d1-id-secrets.mjs";

const SCRIPT = "scripts/check-workflow-d1-id-secrets.mjs";

function runGuard(workflowsDir: string) {
  return spawnSync("node", [SCRIPT], {
    encoding: "utf8",
    env: { ...process.env, WE_MET_WORKFLOW_POLICY_ROOT: workflowsDir },
  });
}

describe("check-workflow-d1-id-secrets pattern (unit)", () => {
  it("matches dot and bracket vars forms and slug suffixes", () => {
    expect(
      "vars.WE_MET_D1_DATABASE_ID_PRODUCTION".match(VARS_D1_DATABASE_ID_PATTERN)?.[0],
    ).toBe("vars.WE_MET_D1_DATABASE_ID_PRODUCTION");
    expect(
      "vars.WE_MET_D1_DATABASE_ID_NONPROD".match(VARS_D1_DATABASE_ID_PATTERN)?.[0],
    ).toBe("vars.WE_MET_D1_DATABASE_ID_NONPROD");
    expect(
      "vars.WE_MET_D1_DATABASE_ID_REPORTS_NONPROD".match(
        VARS_D1_DATABASE_ID_PATTERN,
      )?.[0],
    ).toBe("vars.WE_MET_D1_DATABASE_ID_REPORTS_NONPROD");
    expect(
      findVarsD1DatabaseIdReference(
        "${{ vars['WE_MET_D1_DATABASE_ID_NONPROD'] }}",
      )?.[0],
    ).toBe("vars['WE_MET_D1_DATABASE_ID_NONPROD");
  });

  it("does not match secrets references", () => {
    expect(
      findVarsD1DatabaseIdReference("secrets.WE_MET_D1_DATABASE_ID_PRODUCTION"),
    ).toBeNull();
  });

  it("matches lowercase vars names and uppercase VARS context", () => {
    expect(
      findVarsD1DatabaseIdReference("${{ vars.we_met_d1_database_id_nonprod }}")?.[0],
    ).toBe("vars.we_met_d1_database_id_nonprod");
    expect(
      findVarsD1DatabaseIdReference("${{ VARS.WE_MET_D1_DATABASE_ID_NONPROD }}")?.[0],
    ).toBe("VARS.WE_MET_D1_DATABASE_ID_NONPROD");
  });
});

describe("check-workflow-d1-id-secrets (unit)", () => {
  it("passes on committed workflows", () => {
    const result = spawnSync("node", [SCRIPT], { encoding: "utf8" });
    expect(result.status).toBe(0);
  });

  it("fails when a workflow uses vars for production D1 id", () => {
    const dir = mkdtempSync(join(tmpdir(), "wf-d1-mask-"));
    const workflows = join(dir, "workflows");
    mkdirSync(workflows, { recursive: true });
    writeFileSync(
      join(workflows, "bad.yml"),
      `name: Bad
on: push
jobs:
  x:
    steps:
      - env:
          WE_MET_D1_DATABASE_ID_PRODUCTION: \${{ vars.WE_MET_D1_DATABASE_ID_PRODUCTION }}
        run: echo ok
`,
      "utf8",
    );
    const result = runGuard(workflows);
    rmSync(dir, { recursive: true, force: true });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("bad.yml");
  });

  it("fails when a workflow uses vars for non-prod D1 id", () => {
    const dir = mkdtempSync(join(tmpdir(), "wf-d1-mask-"));
    const workflows = join(dir, "workflows");
    mkdirSync(workflows, { recursive: true });
    writeFileSync(
      join(workflows, "bad-nonprod.yml"),
      `on: push
jobs:
  x:
    steps:
      - env:
          X: \${{ vars.WE_MET_D1_DATABASE_ID_NONPROD }}
        run: true
`,
      "utf8",
    );
    const result = runGuard(workflows);
    rmSync(dir, { recursive: true, force: true });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("bad-nonprod.yml");
  });

  it("fails when a workflow uses vars for a slug D1 id", () => {
    const dir = mkdtempSync(join(tmpdir(), "wf-d1-mask-"));
    const workflows = join(dir, "workflows");
    mkdirSync(workflows, { recursive: true });
    writeFileSync(
      join(workflows, "bad-slug.yml"),
      `on: push
jobs:
  x:
    steps:
      - run: echo \${{ vars.WE_MET_D1_DATABASE_ID_REPORTS_NONPROD }}
`,
      "utf8",
    );
    const result = runGuard(workflows);
    rmSync(dir, { recursive: true, force: true });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("bad-slug.yml");
  });

  it("fails when vars uses lowercase D1 id names", () => {
    const dir = mkdtempSync(join(tmpdir(), "wf-d1-mask-"));
    const workflows = join(dir, "workflows");
    mkdirSync(workflows, { recursive: true });
    writeFileSync(
      join(workflows, "bad-lower.yml"),
      `on: push
jobs:
  x:
    steps:
      - env:
          X: \${{ vars.we_met_d1_database_id_nonprod }}
        run: true
`,
      "utf8",
    );
    const result = runGuard(workflows);
    rmSync(dir, { recursive: true, force: true });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("bad-lower.yml");
  });

  it("fails when VARS context is uppercase", () => {
    const dir = mkdtempSync(join(tmpdir(), "wf-d1-mask-"));
    const workflows = join(dir, "workflows");
    mkdirSync(workflows, { recursive: true });
    writeFileSync(
      join(workflows, "bad-vars-case.yml"),
      `on: push
jobs:
  x:
    steps:
      - run: \${{ VARS.WE_MET_D1_DATABASE_ID_NONPROD }}
`,
      "utf8",
    );
    const result = runGuard(workflows);
    rmSync(dir, { recursive: true, force: true });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("bad-vars-case.yml");
  });

  it("fails on bracket vars syntax in a .yaml workflow", () => {
    const dir = mkdtempSync(join(tmpdir(), "wf-d1-mask-"));
    const workflows = join(dir, "workflows");
    mkdirSync(workflows, { recursive: true });
    writeFileSync(
      join(workflows, "bad-bracket.yaml"),
      `on: push
jobs:
  x:
    steps:
      - env:
          X: \${{ vars['WE_MET_D1_DATABASE_ID_NONPROD'] }}
        run: true
`,
      "utf8",
    );
    const result = runGuard(workflows);
    rmSync(dir, { recursive: true, force: true });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("bad-bracket.yaml");
  });
});
