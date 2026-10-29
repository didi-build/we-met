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
  collectStaticModuleSpecifiers,
  extractRepoScriptEntrypointsFromRun,
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
    const { unlisted, entrypoints, reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath,
    });
    expect(unlisted).toEqual([]);
    expect(entrypoints.length).toBeGreaterThanOrEqual(40);
    expect(reachable.length).toBeGreaterThanOrEqual(96);
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

  it("parses compact import{…}from'…' syntax (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-compact-import-only.mjs`],
      skipSpawnExpansion: true,
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/compact-import-target.mjs",
    );
  });

  it("parses compact export*from'…' syntax (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-compact-export-only.mjs`],
      skipSpawnExpansion: true,
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/compact-export-target.mjs",
    );
  });

  it("follows bash spawnSync script paths (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-bash-spawn.mjs`],
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/spawn-helper.sh",
    );
  });

  it("fail closed on unresolved bash spawn target (fixture)", () => {
    expect(() =>
      analyzeWorkflowImportWalk({
        isPrivilegedPath: () => true,
        extraEntrypoints: [`${resolutionFixtureRoot}/entry-unresolved-bash.mjs`],
        workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
      }),
    ).toThrow(WorkflowImportWalkError);
  });

  it("follows spawnSync from an imported lib, not only from the seed entry (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-spawn-via-lib.mjs`],
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/spawned-target.mjs",
    );
  });

  it("follows node spawn from every reachable file (migrate-nonprod apply.ts)", () => {
    const { entrypoints } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: ["scripts/migrate-nonprod/apply.ts"],
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(entrypoints).toContain("scripts/apply-migrations.mjs");
  });

  it("ignores imports mentioned only in comments (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-comment-import.mjs`],
      skipSpawnExpansion: true,
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toEqual([
      `${resolutionFixtureRoot}/entry-comment-import.mjs`.replace(/\\/g, "/"),
    ]);
  });

  it("parses import default,{named}from syntax (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-default-named.mjs`],
      skipSpawnExpansion: true,
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/default-named-target.mjs",
    );
  });

  it("parses compact side-effect import syntax (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-compact-side-effect.mjs`],
      skipSpawnExpansion: true,
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/side-effect-target.mjs",
    );
  });

  it("follows createRequire bound to a variable (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-create-require-split.mjs`],
      skipSpawnExpansion: true,
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/require-split-target.mjs",
    );
  });

  it("fail closed on non-literal bash spawn path in source (fixture)", () => {
    expect(() =>
      analyzeWorkflowImportWalk({
        isPrivilegedPath: () => true,
        extraEntrypoints: [`${resolutionFixtureRoot}/entry-non-literal-bash.mjs`],
        workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
      }),
    ).toThrow(WorkflowImportWalkError);
  });

  it("follows sh spawnSync array script paths (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-sh-array-spawn.mjs`],
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/spawn-helper.sh",
    );
  });

  it("fail closed on missing workflow entrypoint module (fixture)", () => {
    expect(() =>
      analyzeWorkflowImportWalk({
        isPrivilegedPath: () => true,
        extraEntrypoints: ["scripts/definitely-missing-entrypoint.mjs"],
        skipSpawnExpansion: true,
        workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
      }),
    ).toThrow(WorkflowImportWalkError);
  });

  it("strips shell redirection when parsing node run lines (quoted target)", () => {
    const entries = extractRepoScriptEntrypointsFromRun(
      'node scripts/ci-test-summary.mjs >> "$GITHUB_OUTPUT"',
      {},
    );
    expect(entries).toEqual(["scripts/ci-test-summary.mjs"]);
  });

  it("strips shell redirection when parsing node run lines (no space before >>)", () => {
    const entries = extractRepoScriptEntrypointsFromRun(
      "node scripts/ci-test-summary.mjs>>out",
      {},
    );
    expect(entries).toEqual(["scripts/ci-test-summary.mjs"]);
  });

  it("parses ./scripts/ paths in workflow run lines", () => {
    const entries = extractRepoScriptEntrypointsFromRun(
      "./scripts/ci-test-summary.mjs",
      {},
    );
    expect(entries).toContain("scripts/ci-test-summary.mjs");
  });

  it("fail closed on bash scripts/$X.sh in workflow run lines", () => {
    expect(() => extractRepoScriptEntrypointsFromRun("bash scripts/$X.sh", {})).toThrow(
      WorkflowImportWalkError,
    );
  });

  it('fail closed on bash "$X" in workflow run lines', () => {
    expect(() => extractRepoScriptEntrypointsFromRun('bash "$X"', {})).toThrow(
      WorkflowImportWalkError,
    );
  });

  it("fail closed on bash $X in workflow run lines", () => {
    expect(() => extractRepoScriptEntrypointsFromRun("bash $X", {})).toThrow(
      WorkflowImportWalkError,
    );
  });

  it("parses bash with repo script path in workflow run lines", () => {
    const entries = extractRepoScriptEntrypointsFromRun(
      "bash scripts/check-deploy-guards.mjs",
      {},
    );
    expect(entries).toContain("scripts/check-deploy-guards.mjs");
  });

  it("parses npx --yes tsx run lines", () => {
    const entries = extractRepoScriptEntrypointsFromRun(
      "npx --yes tsx scripts/migrate-nonprod/plan.ts",
      {},
    );
    expect(entries).toContain("scripts/migrate-nonprod/plan.ts");
  });

  it("parses bare tsx run lines", () => {
    const entries = extractRepoScriptEntrypointsFromRun(
      "tsx scripts/migrate-nonprod/plan.ts",
      {},
    );
    expect(entries).toContain("scripts/migrate-nonprod/plan.ts");
  });

  it("parses npm exec run lines", () => {
    const entries = extractRepoScriptEntrypointsFromRun(
      "npm exec -- scripts/migrate-nonprod/plan.ts",
      {},
    );
    expect(entries).toContain("scripts/migrate-nonprod/plan.ts");
  });

  it("parses node workers/ run lines", () => {
    const entries = extractRepoScriptEntrypointsFromRun(
      "node workers/warmup/index.ts",
      {},
    );
    expect(entries).toContain("workers/warmup/index.ts");
  });

  it("parses node gallery/ run lines", () => {
    const entries = extractRepoScriptEntrypointsFromRun("node gallery/main.tsx", {});
    expect(entries).toContain("gallery/main.tsx");
  });

  it('follows execSync("bash <script.sh>") in source (fixture)', () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-execsync-bash.mjs`],
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/execsync-target.sh",
    );
  });

  it("ignores bash script paths mentioned only in comments (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-bash-comment-only.mjs`],
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).not.toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/execsync-target.sh",
    );
  });

  it("parses imports after a regex literal (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-regex-literal.mjs`],
      skipSpawnExpansion: true,
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/after-regex.mjs",
    );
  });

  it("follows /usr/bin/bash spawnSync arrays (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-usr-bin-bash.mjs`],
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/execsync-target.sh",
    );
  });

  it("fail closed on template literals in bash spawn arrays (fixture)", () => {
    expect(() =>
      analyzeWorkflowImportWalk({
        isPrivilegedPath: () => true,
        extraEntrypoints: [`${resolutionFixtureRoot}/entry-template-literal-bash.mjs`],
        workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
      }),
    ).toThrow(WorkflowImportWalkError);
  });

  it("collectStaticModuleSpecifiers reads scripts/migrate-nonprod/apply.ts", () => {
    const content = readFileSync("scripts/migrate-nonprod/apply.ts", "utf8");
    const specs = collectStaticModuleSpecifiers(
      content,
      "scripts/migrate-nonprod/apply.ts",
    );
    expect(specs).toContain("./comment-body.mjs");
    expect(specs).toContain("./validate.mjs");
    expect(specs.length).toBeGreaterThanOrEqual(8);
  });

  it("parses nested template then import (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-nested-template.mjs`],
      skipSpawnExpansion: true,
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/after-nested-template.mjs",
    );
  });

  it("parses return /'/ then glob string then import (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-return-regex.mjs`],
      skipSpawnExpansion: true,
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/after-return-regex.mjs",
    );
  });

  it("parses /[/']/ regex class with single-quoted URL (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-regex-char-class.mjs`],
      skipSpawnExpansion: true,
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/after-regex-char.mjs",
    );
  });

  it("follows sh -c bash spawnSync arrays (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-sh-c-bash.mjs`],
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/execsync-target.sh",
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
