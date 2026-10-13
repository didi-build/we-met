import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  findActionsPolicyWorkflowViolations,
  hasInlineWorkflowOnClause,
} from "../scripts/check-actions-policy-workflows.mjs";

const allowlist = {
  allowedEvents: ["pull_request_target", "workflow_dispatch", "workflow_run"],
  workflows: [
    ".github/workflows/privileged-change.yml",
    ".github/workflows/migrate-nonprod.yml",
    ".github/workflows/dependabot-automerge.yml",
  ],
};

function writeWorkflow(dir: string, name: string, body: string) {
  writeFileSync(join(dir, name), body, "utf8");
}

describe("hasInlineWorkflowOnClause (unit)", () => {
  it("detects inline on forms", () => {
    expect(hasInlineWorkflowOnClause("on: pull_request_target\n")).toBe(true);
    expect(hasInlineWorkflowOnClause("on: [push, pull_request_target]\n")).toBe(true);
    expect(hasInlineWorkflowOnClause("on:\n  push:\n")).toBe(false);
  });
});

describe("findActionsPolicyWorkflowViolations (table)", () => {
  it("pull_request_target workflow not listed fails", () => {
    const root = mkdtempSync(join(tmpdir(), "actions-policy-"));
    const workflowsDir = join(root, ".github/workflows");
    mkdirSync(workflowsDir, { recursive: true });
    writeWorkflow(
      workflowsDir,
      "evil.yml",
      "name: evil\non:\n  pull_request_target:\n    types: [opened]\n",
    );
    const violations = findActionsPolicyWorkflowViolations({
      repoRoot: root,
      config: allowlist,
      workflowsDir,
    });
    expect(
      violations.some((v) => v.includes("evil.yml") && v.includes("not listed")),
    ).toBe(true);
  });

  it("listed workflow with only allowed triggers passes", () => {
    const root = mkdtempSync(join(tmpdir(), "actions-policy-"));
    const workflowsDir = join(root, ".github/workflows");
    mkdirSync(workflowsDir, { recursive: true });
    const config = {
      allowedEvents: ["pull_request_target"],
      workflows: [".github/workflows/privileged-change.yml"],
    };
    writeWorkflow(
      workflowsDir,
      "privileged-change.yml",
      "name: pc\non:\n  pull_request_target:\n    types: [opened]\npermissions:\n  issues: write\n",
    );
    expect(
      findActionsPolicyWorkflowViolations({
        repoRoot: root,
        config,
        workflowsDir,
      }),
    ).toEqual([]);
  });

  it("listed workflow with an extra push trigger fails", () => {
    const root = mkdtempSync(join(tmpdir(), "actions-policy-"));
    const workflowsDir = join(root, ".github/workflows");
    mkdirSync(workflowsDir, { recursive: true });
    writeWorkflow(
      workflowsDir,
      "migrate-nonprod.yml",
      "name: m\non:\n  pull_request_target:\n    types: [opened]\n  push:\n    branches: [main]\n",
    );
    const violations = findActionsPolicyWorkflowViolations({
      repoRoot: root,
      config: allowlist,
      workflowsDir,
    });
    expect(
      violations.some((v) => v.includes("push") && v.includes("migrate-nonprod.yml")),
    ).toBe(true);
  });

  it("listed file missing fails", () => {
    const root = mkdtempSync(join(tmpdir(), "actions-policy-"));
    const workflowsDir = join(root, ".github/workflows");
    mkdirSync(workflowsDir, { recursive: true });
    const violations = findActionsPolicyWorkflowViolations({
      repoRoot: root,
      config: allowlist,
      workflowsDir,
    });
    expect(violations.some((v) => v.includes("missing"))).toBe(true);
  });

  it("inline on form fails closed", () => {
    const fixture = readFileSync(
      join("test/fixtures/actions-policy-workflows", "inline-on.yml"),
      "utf8",
    );
    expect(hasInlineWorkflowOnClause(fixture)).toBe(true);
    const root = mkdtempSync(join(tmpdir(), "actions-policy-"));
    const workflowsDir = join(root, ".github/workflows");
    mkdirSync(workflowsDir, { recursive: true });
    writeWorkflow(workflowsDir, "inline.yml", fixture);
    const violations = findActionsPolicyWorkflowViolations({
      repoRoot: root,
      config: allowlist,
      workflowsDir,
    });
    expect(
      violations.some((v) => v.includes("inline") && v.includes("cannot determine")),
    ).toBe(true);
  });

  it("dispatch-only unlisted workflow passes", () => {
    const root = mkdtempSync(join(tmpdir(), "actions-policy-"));
    const workflowsDir = join(root, ".github/workflows");
    mkdirSync(workflowsDir, { recursive: true });
    writeWorkflow(
      workflowsDir,
      "manual.yml",
      "name: manual\non:\n  workflow_dispatch:\n",
    );
    writeWorkflow(
      workflowsDir,
      "privileged-change.yml",
      "name: pc\non:\n  pull_request_target:\n    types: [opened]\n",
    );
    writeWorkflow(
      workflowsDir,
      "migrate-nonprod.yml",
      "name: m\non:\n  pull_request_target:\n    types: [opened]\n  workflow_dispatch:\n",
    );
    writeWorkflow(
      workflowsDir,
      "dependabot-automerge.yml",
      "name: d\non:\n  pull_request_target:\n    types: [opened]\n  workflow_run:\n    workflows: [CI]\n    types: [completed]\n",
    );
    expect(
      findActionsPolicyWorkflowViolations({
        repoRoot: root,
        config: allowlist,
        workflowsDir,
      }),
    ).toEqual([]);
  });
});

describe("checkActionsPolicyWorkflows at repo root (integration)", () => {
  it("real .github/workflows tree passes against the real allowlist file", async () => {
    const { checkActionsPolicyWorkflowsAtRepoRoot } =
      await import("../scripts/check-actions-policy-workflows.mjs");
    expect(checkActionsPolicyWorkflowsAtRepoRoot(process.cwd())).toEqual([]);
  });
});
