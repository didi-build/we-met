import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isPrivilegedPath,
  privilegedPathMatchers,
  workflowModuleExactPrivilegedEntries,
} from "../scripts/lib/privileged-paths.mjs";
import {
  analyzeWorkflowImportWalk,
  WorkflowImportWalkError,
} from "../scripts/lib/privileged-workflow-import-walk.mjs";

const fixtureWorkflowsDir = join("test/fixtures/privileged-workflow-import-walk");
const fixtureUnlistedPath =
  "test/fixtures/privileged-workflow-import-walk/unlisted-helper.mjs";
const resolutionFixtureRoot = join(
  "test/fixtures/privileged-workflow-import-walk/resolution",
);

describe("privileged-workflow-import-walk", () => {
  it("lists every workflow-reachable repo module as privileged", () => {
    const { unlisted } = analyzeWorkflowImportWalk({ isPrivilegedPath });
    expect(unlisted).toEqual([]);
  });

  it("documents accepted gaps in the walk module header (ADR 0005)", () => {
    const source = readFileSync(
      "scripts/lib/privileged-workflow-import-walk.mjs",
      "utf8",
    );
    expect(source).toMatch(/^\/\*\*[\s\S]*Accepted gaps \(ADR 0005/m);
    expect(source).toMatch(
      /Dynamic import\(\) when the module specifier is not a string literal/,
    );
  });

  it("fails when a reachable module is not privileged (fixture)", () => {
    const { unlisted } = analyzeWorkflowImportWalk({
      isPrivilegedPath,
      workflowsDir: fixtureWorkflowsDir,
      extraEntrypoints: [],
      skipSpawnExpansion: true,
    });
    expect(unlisted).toContain(fixtureUnlistedPath);
  });

  it("fail closed on unresolved imports (fixture)", () => {
    expect(() =>
      analyzeWorkflowImportWalk({
        isPrivilegedPath,
        extraEntrypoints: [`${resolutionFixtureRoot}/entry-unresolved.mjs`],
        skipSpawnExpansion: true,
        workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
      }),
    ).toThrow(WorkflowImportWalkError);
    try {
      analyzeWorkflowImportWalk({
        isPrivilegedPath,
        extraEntrypoints: [`${resolutionFixtureRoot}/entry-unresolved.mjs`],
        skipSpawnExpansion: true,
        workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
      });
    } catch (error) {
      expect(error).toBeInstanceOf(WorkflowImportWalkError);
      expect((error as WorkflowImportWalkError).module).toMatch(
        /definitely-missing-module/,
      );
    }
  });

  it("follows re-export static imports (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-reexport.mjs`],
      skipSpawnExpansion: true,
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/leaf.mjs",
    );
  });

  it("resolves directory index modules (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-index.mjs`],
      skipSpawnExpansion: true,
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/indexed/index.mjs",
    );
  });

  it("resolves .js import to .ts (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-js-ts.mjs`],
      skipSpawnExpansion: true,
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/target.ts",
    );
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
