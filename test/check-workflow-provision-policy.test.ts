import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  parseWorkflowTriggerEvents,
  workflowUsesPullRequestTrigger,
} from "../scripts/check-workflow-provision-policy.mjs";

const SCRIPT = "scripts/check-workflow-provision-policy.mjs";

describe("check-workflow-provision-policy (unit)", () => {
  it("passes on committed workflows", () => {
    const result = spawnSync("node", [SCRIPT], { encoding: "utf8" });
    expect(result.status).toBe(0);
  });

  it("parses on: pull_request map form", () => {
    const triggers = parseWorkflowTriggerEvents(`name: X
on:
  pull_request:
    types: [opened]
jobs: {}
`);
    expect(triggers).toContain("pull_request");
    expect(workflowUsesPullRequestTrigger(triggers ?? [])).toBe(true);
  });

  it("parses on: [pull_request, push] list form", () => {
    const triggers = parseWorkflowTriggerEvents(`name: X
on: [pull_request, push]
jobs: {}
`);
    expect(triggers).toEqual(expect.arrayContaining(["pull_request", "push"]));
  });

  it("parses on: pull_request string form", () => {
    const triggers = parseWorkflowTriggerEvents(`name: X
on: pull_request
jobs: {}
`);
    expect(triggers).toEqual(["pull_request"]);
  });

  it("does not treat pull_request_target as pull_request", () => {
    const triggers = parseWorkflowTriggerEvents(`name: X
on:
  pull_request_target:
    types: [opened]
jobs: {}
`);
    expect(triggers).toContain("pull_request_target");
    expect(workflowUsesPullRequestTrigger(triggers ?? [])).toBe(false);
  });

  it("fails when a pull_request workflow references provision-resources (map form)", () => {
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

  it("fails when provision runs on pull_request string on form", () => {
    const dir = mkdtempSync(join(tmpdir(), "wf-policy-"));
    const workflows = join(dir, "workflows");
    mkdirSync(workflows, { recursive: true });
    writeFileSync(
      join(workflows, "bad-string.yml"),
      `name: Bad
on: pull_request
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
    expect(result.stderr).toContain("bad-string.yml");
  });

  it("fails when provision runs on pull_request inline list on form", () => {
    const dir = mkdtempSync(join(tmpdir(), "wf-policy-"));
    const workflows = join(dir, "workflows");
    mkdirSync(workflows, { recursive: true });
    writeFileSync(
      join(workflows, "bad-list.yml"),
      `name: Bad
on: [pull_request, workflow_dispatch]
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
    expect(result.stderr).toContain("bad-list.yml");
  });
});
