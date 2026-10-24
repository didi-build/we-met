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

function runProvisionPolicyCli(workflows: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "wf-policy-"));
  const workflowsDir = join(dir, "workflows");
  mkdirSync(workflowsDir, { recursive: true });
  for (const [name, body] of Object.entries(workflows)) {
    writeFileSync(join(workflowsDir, name), body, "utf8");
  }
  const result = spawnSync("node", [SCRIPT], {
    encoding: "utf8",
    env: { ...process.env, WE_MET_WORKFLOW_POLICY_ROOT: workflowsDir },
  });
  rmSync(dir, { recursive: true, force: true });
  return result;
}

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

  it("parses on: flow-map form", () => {
    const triggers = parseWorkflowTriggerEvents(`name: X
on: { pull_request: { types: [opened] }, workflow_dispatch: {} }
jobs: {}
`);
    expect(triggers).toEqual(
      expect.arrayContaining(["pull_request", "workflow_dispatch"]),
    );
    expect(workflowUsesPullRequestTrigger(triggers ?? [])).toBe(true);
  });

  it("returns null for unknown on: inline form", () => {
    const triggers = parseWorkflowTriggerEvents(`name: X
on: "*"
jobs: {}
`);
    expect(triggers).toBeNull();
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
    const result = runProvisionPolicyCli({
      "bad-preview.yml": `name: Bad
on:
  pull_request:
    types: [opened]
jobs:
  x:
    steps:
      - run: node scripts/provision-resources.mjs
`,
      "ok-migrate.yml": `name: Ok
on:
  pull_request_target:
    types: [opened]
jobs:
  x:
    steps:
      - run: node scripts/provision-resources.mjs
`,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("bad-preview.yml");
  });

  it("fails when a pull_request .yaml workflow references provision-resources", () => {
    const result = runProvisionPolicyCli({
      "bad-preview.yaml": `name: Bad
on:
  pull_request:
    types: [opened]
jobs:
  x:
    steps:
      - run: node scripts/provision-resources.mjs
`,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("bad-preview.yaml");
    expect(result.stderr).toContain("must not run");
  });

  it("fails when provision runs on pull_request string on form", () => {
    const result = runProvisionPolicyCli({
      "bad-string.yml": `name: Bad
on: pull_request
jobs:
  x:
    steps:
      - run: node scripts/provision-resources.mjs
`,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("bad-string.yml");
  });

  it("fails when provision workflow on: triggers cannot be parsed (unknown inline)", () => {
    const result = runProvisionPolicyCli({
      "bad-unknown-on.yml": `name: Bad
on: "*"
jobs:
  x:
    steps:
      - run: node scripts/provision-resources.mjs
`,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("bad-unknown-on.yml");
    expect(result.stderr).toContain("could not be parsed");
  });

  it("fails when provision workflow has no on: key", () => {
    const result = runProvisionPolicyCli({
      "bad-no-on.yml": `name: Bad
jobs:
  x:
    steps:
      - run: node scripts/provision-resources.mjs
`,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("bad-no-on.yml");
    expect(result.stderr).toContain("could not be parsed");
  });

  it("fails when provision workflow has empty on: []", () => {
    const result = runProvisionPolicyCli({
      "bad-empty-on.yml": `name: Bad
on: []
jobs:
  x:
    steps:
      - run: node scripts/provision-resources.mjs
`,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("bad-empty-on.yml");
    expect(result.stderr).toContain("could not be parsed");
  });

  it("fails when provision workflow has malformed flow-map on:", () => {
    const result = runProvisionPolicyCli({
      "bad-flow-map.yml": `name: Bad
on: { pull_request: {
jobs:
  x:
    steps:
      - run: node scripts/provision-resources.mjs
`,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("bad-flow-map.yml");
    expect(result.stderr).toContain("could not be parsed");
  });

  it("fails when provision workflow uses quoted on key inline", () => {
    const result = runProvisionPolicyCli({
      "bad-quoted-on.yml": `name: Bad
"on": push
jobs:
  x:
    steps:
      - run: node scripts/provision-resources.mjs
`,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("bad-quoted-on.yml");
    expect(result.stderr).toContain("could not be parsed");
  });

  it("fails when provision runs on pull_request inline list on form", () => {
    const result = runProvisionPolicyCli({
      "bad-list.yml": `name: Bad
on: [pull_request, workflow_dispatch]
jobs:
  x:
    steps:
      - run: node scripts/provision-resources.mjs
`,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("bad-list.yml");
  });

  it("fails when provision runs on pull_request flow-map on form", () => {
    const result = runProvisionPolicyCli({
      "bad-flow-map-pr.yml": `name: Bad
on: { pull_request: {}, workflow_dispatch: {} }
jobs:
  x:
    steps:
      - run: node scripts/provision-resources.mjs
`,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("bad-flow-map-pr.yml");
    expect(result.stderr).toContain("must not run");
    expect(result.stderr).toContain("pull_request");
  });
});
