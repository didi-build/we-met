import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isPrivilegedPath,
  privilegedPathMatchers,
  workflowModuleExactPrivilegedEntries,
} from "../scripts/lib/privileged-paths.mjs";
import { analyzeWorkflowImportWalk } from "../scripts/lib/privileged-workflow-import-walk.mjs";

const fixtureWorkflowsDir = join("test/fixtures/privileged-workflow-import-walk");
const fixtureUnlistedPath =
  "test/fixtures/privileged-workflow-import-walk/unlisted-helper.mjs";

describe("privileged-workflow-import-walk", () => {
  it("lists every workflow-reachable repo module as privileged", () => {
    const { unlisted } = analyzeWorkflowImportWalk({ isPrivilegedPath });
    expect(unlisted).toEqual([]);
  });

  it("documents dynamic import() with non-literal arguments as an accepted gap (ADR 0005)", () => {
    const source = readFileSync(
      "scripts/lib/privileged-workflow-import-walk.mjs",
      "utf8",
    );
    expect(source).toMatch(/Dynamic import\(\) with a non-literal argument/);
    expect(source).toMatch(/ADR 0005/);
  });

  it("fails when a reachable module is not privileged (fixture)", () => {
    const { unlisted } = analyzeWorkflowImportWalk({
      isPrivilegedPath,
      workflowsDir: fixtureWorkflowsDir,
      extraEntrypoints: [],
    });
    expect(unlisted).toContain(fixtureUnlistedPath);
  });

  for (const entry of workflowModuleExactPrivilegedEntries) {
    it(`mutant: removing matcher ${entry.id} leaves ${entry.path} unlisted`, () => {
      const matchers = privilegedPathMatchers.filter((m) => m.id !== entry.id);
      const isPrivilegedPathWithoutEntry = (filename: string) =>
        matchers.some((m) => m.test(filename));
      const { unlisted } = analyzeWorkflowImportWalk({
        isPrivilegedPath: isPrivilegedPathWithoutEntry,
      });
      expect(unlisted).toContain(entry.path);
    });
  }
});
