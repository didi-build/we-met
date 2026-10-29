import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  isPrivilegedPath,
  privilegedPathMatchers,
  workflowModuleExactPrivilegedEntries,
} from "../scripts/lib/privileged-paths.mjs";
import {
  analyzeWorkflowImportWalk,
  collectStaticModuleSpecifiers,
  WorkflowImportWalkError,
} from "../scripts/lib/privileged-workflow-import-walk.mjs";

const fixtureWorkflowsDir = join("test/fixtures/privileged-workflow-import-walk");
const fixtureUnlistedPath =
  "test/fixtures/privileged-workflow-import-walk/unlisted-helper.mjs";
const resolutionFixtureRoot = join(
  "test/fixtures/privileged-workflow-import-walk/resolution",
);
const reachableBaselinePath = join(fixtureWorkflowsDir, "reachable-baseline-main.json");

describe("privileged-workflow-import-walk", () => {
  it("lists every workflow-reachable repo module as privileged", () => {
    const { unlisted } = analyzeWorkflowImportWalk({ isPrivilegedPath });
    expect(unlisted).toEqual([]);
  });

  it("does not drop workflow-reachable files vs pinned main baseline", () => {
    const baseline = JSON.parse(
      readFileSync(reachableBaselinePath, "utf8"),
    ) as string[];
    const { reachable } = analyzeWorkflowImportWalk({ isPrivilegedPath });
    const reachableSet = new Set(reachable);
    const missing = baseline.filter((file) => !reachableSet.has(file));
    expect(missing).toEqual([]);
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

  it("parses imports after a regex literal with a quote (fixture)", () => {
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

  it("parses node-array template shape then import (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-apply-template-shape.mjs`],
      skipSpawnExpansion: true,
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/after-apply-shape.mjs",
    );
  });

  it("follows createRequire(import.meta.url)(...) (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-create-require-inline.mjs`],
      skipSpawnExpansion: true,
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/cr-target.cjs",
    );
  });

  it("follows bound createRequire variable calls (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-create-require-bound.mjs`],
      skipSpawnExpansion: true,
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/require-split-target.mjs",
    );
  });

  it("same-line typeof /'/ then import (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-same-line-typeof.mjs`],
      skipSpawnExpansion: true,
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/after-typeof.mjs",
    );
  });

  it("same-line await /'/ then import (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-same-line-await.mjs`],
      skipSpawnExpansion: true,
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/after-await.mjs",
    );
  });

  it("same-line case /'/ then import (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-same-line-case.mjs`],
      skipSpawnExpansion: true,
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/after-case.mjs",
    );
  });

  it("same-line brace then /'/ then import (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-same-line-brace.mjs`],
      skipSpawnExpansion: true,
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/after-brace.mjs",
    );
  });

  it("same-line return /'/ then import (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-same-line-return.mjs`],
      skipSpawnExpansion: true,
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/after-return.mjs",
    );
  });

  it("same-line regex fixtures stay on one physical line with single-quoted imports", () => {
    const expectedFirstLine: Record<string, string> = {
      "entry-same-line-typeof.mjs":
        "const t = typeof /'/; import './after-typeof.mjs';",
      "entry-same-line-await.mjs":
        "async function f(){ await /'/; } import './after-await.mjs';",
      "entry-same-line-case.mjs":
        "switch (x) { case /'/.source: break; } import './after-case.mjs';",
      "entry-same-line-brace.mjs": "if (a) {} /'/.test(s); import './after-brace.mjs';",
      "entry-same-line-return.mjs":
        "function f(){ return /'/; } import './after-return.mjs';",
    };
    for (const [name, firstLine] of Object.entries(expectedFirstLine)) {
      const raw = readFileSync(join(resolutionFixtureRoot, name), "utf8");
      const lines = raw
        .split("\n")
        .filter((line, index, all) =>
          index < all.length - 1 ? true : line.length > 0,
        );
      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe(firstLine);
    }
    const globRaw = readFileSync(
      join(resolutionFixtureRoot, "entry-regex-glob-bash.mjs"),
      "utf8",
    );
    expect(globRaw.split("\n")[0]).toBe("const r = /'/; const g = 'src/*.ts';");
  });

  it("ts.preProcessFile misses same-line import targets (lexer guard)", () => {
    const cases: { fixture: string; target: string }[] = [
      { fixture: "entry-same-line-typeof.mjs", target: "./after-typeof.mjs" },
      { fixture: "entry-same-line-await.mjs", target: "./after-await.mjs" },
      { fixture: "entry-same-line-case.mjs", target: "./after-case.mjs" },
      { fixture: "entry-same-line-brace.mjs", target: "./after-brace.mjs" },
      { fixture: "entry-same-line-return.mjs", target: "./after-return.mjs" },
      { fixture: "entry-regex-glob-bash.mjs", target: "./after-regex-glob.mjs" },
    ];
    for (const { fixture, target } of cases) {
      const content = readFileSync(join(resolutionFixtureRoot, fixture), "utf8");
      const preprocessed = ts.preProcessFile(content, true, true);
      const imported = preprocessed.importedFiles
        .map((entry) => entry.fileName)
        .filter((name): name is string => Boolean(name));
      expect(imported).not.toContain(target);
    }
  });

  it("regex quote, glob string, import, and execSync bash (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-regex-glob-bash.mjs`],
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/after-regex-glob.mjs",
    );
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/bash-via-execsync.sh",
    );
  });

  it("fail closed on spawn array template with substitution (fixture)", () => {
    expect(() =>
      analyzeWorkflowImportWalk({
        isPrivilegedPath: () => true,
        extraEntrypoints: [`${resolutionFixtureRoot}/entry-spawn-template-sub.mjs`],
        workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
      }),
    ).toThrow(WorkflowImportWalkError);
  });

  it("follows spawn array no-substitution template literal (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-spawn-template-nosub.mjs`],
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/template-spawn-target.mjs",
    );
  });

  it("follows plain require() in a .cjs entry (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-plain-require.cjs`],
      skipSpawnExpansion: true,
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/plain-require-target.cjs",
    );
  });

  it("follows dynamic await import() (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-dynamic-import.mjs`],
      skipSpawnExpansion: true,
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/dynamic-import-target.mjs",
    );
  });

  it("follows both branches in conditional spawn array literals (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-spawn-conditional.mjs`],
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/spawn-cond-a.mjs",
    );
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/spawn-cond-b.mjs",
    );
  });

  it("follows module.createRequire(import.meta.url)(...) (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-module-create-require.mjs`],
      skipSpawnExpansion: true,
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/module-cr-target.cjs",
    );
  });

  it("follows import x = require('./y') (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-import-equals.cts`],
      skipSpawnExpansion: true,
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/import-equals-target.mjs",
    );
  });

  it("follows bash inside a .sh workflow script (fixture)", () => {
    const { reachable } = analyzeWorkflowImportWalk({
      isPrivilegedPath: () => true,
      extraEntrypoints: [`${resolutionFixtureRoot}/entry-sh-calls-sh.sh`],
      workflowsDir: join(resolutionFixtureRoot, "empty-workflows"),
    });
    expect(reachable).toContain(
      "test/fixtures/privileged-workflow-import-walk/resolution/nested-sh-target.sh",
    );
  });

  it("fail closed on parse errors", () => {
    expect(() =>
      collectStaticModuleSpecifiers(
        'export const broken = (;\nimport "./leaf.mjs";\n',
        "parse-error-snippet.mjs",
      ),
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
