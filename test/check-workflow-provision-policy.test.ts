import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const SCRIPT = "scripts/check-workflow-provision-policy.mjs";

describe("check-workflow-provision-policy (unit)", () => {
  it("passes on committed workflows", () => {
    const result = spawnSync("node", [SCRIPT], { encoding: "utf8" });
    expect(result.status).toBe(0);
  });

  it("fails when a pull_request workflow references provision-resources", () => {
    const dir = mkdtempSync(join(tmpdir(), "wf-policy-"));
    const workflows = join(dir, "workflows");
    mkdirSync(workflows, { recursive: true });
    writeFileSync(
      join(workflows, "bad-preview.yml"),
      `name: Bad
on:
  pull_request:
    types: [opened]
jobs:
  x:
    steps:
      - run: node scripts/provision-resources.mjs
`,
      "utf8",
    );
    writeFileSync(
      join(workflows, "ok-migrate.yml"),
      `name: Ok
on:
  pull_request_target:
    types: [opened]
jobs:
  x:
    steps:
      - run: node scripts/provision-resources.mjs
`,
      "utf8",
    );
    const result = spawnSync("node", [SCRIPT], {
      encoding: "utf8",
      env: { ...process.env, WE_MET_WORKFLOW_POLICY_ROOT: workflows },
    });
    rmSync(dir, { recursive: true, force: true });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("bad-preview.yml");
  });
});
