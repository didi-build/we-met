import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  analyzeWorkflowImportWalk,
  WorkflowImportWalkError,
} from "../scripts/lib/privileged-workflow-import-walk.mjs";

const resolutionFixtureRoot = join(
  "test/fixtures/privileged-workflow-import-walk/resolution",
);
const emptyWorkflows = join(resolutionFixtureRoot, "empty-workflows");

function walkFromEntry(
  entryRel: string,
  skipSpawnExpansion = false,
  packageJsonPath?: string,
) {
  return analyzeWorkflowImportWalk({
    isPrivilegedPath: () => true,
    extraEntrypoints: [`${resolutionFixtureRoot}/${entryRel}`],
    skipSpawnExpansion,
    workflowsDir: emptyWorkflows,
    ...(packageJsonPath ? { packageJsonPath } : {}),
  });
}

describe("privileged-workflow-import-walk (DIDI-995)", () => {
  it("N10: npm spawn array literal repo script (fixture)", () => {
    const { reachable } = walkFromEntry("entry-npm-spawn-exec.mjs");
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/npm-exec-target.mjs",
    );
  });

  it("N11: npm run inside spawn array reaches package script entry (fixture)", () => {
    const { reachable } = walkFromEntry(
      "entry-npm-spawn-run.mjs",
      false,
      `${resolutionFixtureRoot}/fixture-package.json`,
    );
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/npm-run-target.mjs",
    );
  });

  it("N13b: /usr/bin/bash spawn array reaches .sh target (fixture)", () => {
    const { reachable } = walkFromEntry("entry-usr-bin-bash-spawn.mjs");
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/usr-bin-target.sh",
    );
  });

  it("N15': no-substitution template in require() reaches target (fixture)", () => {
    const { reachable } = walkFromEntry("entry-template-require.cjs", true);
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/template-import-target.cjs",
    );
  });

  it("N15': no-substitution template in import() reaches target (fixture)", () => {
    const { reachable } = walkFromEntry("entry-template-import.mjs", true);
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/template-import-target.mjs",
    );
  });

  it("N15': template with substitution in import() fails closed (fixture)", () => {
    expect(() => walkFromEntry("entry-template-import-sub.mjs", true)).toThrow(
      WorkflowImportWalkError,
    );
  });

  it("N16: member callee cp.spawnSync reaches node script (fixture)", () => {
    const { reachable } = walkFromEntry("entry-member-spawn.mjs");
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/member-spawn-target.mjs",
    );
  });

  it("N17: execSync two-arg array form reaches node script (fixture)", () => {
    const { reachable } = walkFromEntry("entry-exec-array.mjs");
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/exec-array-target.mjs",
    );
  });

  it("N17: exec two-arg array form reaches node script (fixture)", () => {
    const { reachable } = walkFromEntry("entry-exec-fn-array.mjs");
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/exec-fn-target.mjs",
    );
  });

  it("N15': template with substitution in require() fails closed (fixture)", () => {
    expect(() => walkFromEntry("entry-template-require-sub.cjs", true)).toThrow(
      WorkflowImportWalkError,
    );
  });

  it("N15': template with substitution in createRequire() call fails closed (fixture)", () => {
    expect(() => walkFromEntry("entry-create-require-template-sub.mjs", true)).toThrow(
      WorkflowImportWalkError,
    );
  });

  it("R3: spawn array template substitution still fails closed after deduping throws (fixture)", () => {
    expect(() => walkFromEntry("entry-spawn-template-sub.mjs")).toThrow(
      WorkflowImportWalkError,
    );
  });

  it("/bin/bash spawnSync reaches .sh target (fixture)", () => {
    const { reachable } = walkFromEntry("entry-bin-bash-spawn.mjs");
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/bin-bash-target.sh",
    );
  });

  it("/bin/sh spawnSync reaches .sh target (fixture)", () => {
    const { reachable } = walkFromEntry("entry-bin-sh-spawn.mjs");
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/bin-sh-target.sh",
    );
  });

  it("/bin/bash inside .sh workflow script reaches nested .sh (fixture)", () => {
    const { reachable } = walkFromEntry("entry-sh-bin-bash.sh");
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/bin-bash-target.sh",
    );
  });

  it("/bin/sh inside .sh workflow script reaches nested .sh (fixture)", () => {
    const { reachable } = walkFromEntry("entry-sh-bin-sh.sh");
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/bin-sh-target.sh",
    );
  });

  it("let-bound createRequire reaches target (fixture)", () => {
    const { reachable } = walkFromEntry("entry-let-create-require.mjs", true);
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/let-cr-target.cjs",
    );
  });

  it("later-assigned let createRequire reaches target (fixture)", () => {
    const { reachable } = walkFromEntry("entry-let-assign-create-require.mjs", true);
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/let-assign-cr-target.cjs",
    );
  });

  it("reachable workflow script with spawn template substitution throws, not skip (fixture)", () => {
    expect(() =>
      analyzeWorkflowImportWalk({
        isPrivilegedPath: () => true,
        extraEntrypoints: [`${resolutionFixtureRoot}/entry-spawn-template-sub.mjs`],
        workflowsDir: emptyWorkflows,
      }),
    ).toThrow(/Template literal with substitution in spawn array/);
  });

  it("entry-sh-calls-sh still passes after removing dead .sh branch in regex helper", () => {
    const { reachable } = walkFromEntry("entry-sh-calls-sh.sh");
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/nested-sh-target.sh",
    );
  });
});
