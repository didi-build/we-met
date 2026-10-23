import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const SCRIPT = "scripts/check-workflow-d1-id-secrets.mjs";

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
    const result = spawnSync("node", [SCRIPT], {
      encoding: "utf8",
      env: { ...process.env, WE_MET_WORKFLOW_POLICY_ROOT: workflows },
    });
    rmSync(dir, { recursive: true, force: true });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("bad.yml");
  });
});
