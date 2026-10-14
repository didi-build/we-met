import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  isSuccessfulDeploymentStatus,
  pickBaselineShaFromDeployments,
} from "../scripts/deploy-production/baseline.mjs";
import {
  collectComparePages,
  mergeCompareApiPages,
} from "../scripts/deploy-production/compare-pages.mjs";
import {
  decideMigrationPlan,
  GITHUB_COMPARE_CHANGED_FILES_CAP,
  isCleanAheadCompare,
  isCompareFileListNearCap,
  isMigrationSqlPath,
  selectMigrationChangesFromCompare,
} from "../scripts/deploy-production/compare-migrations.mjs";
import { formatMigrationIntroduction } from "../scripts/deploy-production/attribution.mjs";
import { collectAdvisoryLintWarnings } from "../scripts/deploy-production/advisory-lint";
import {
  classifyPlanFailure,
  errorToDiagnosticText,
} from "../scripts/deploy-production/failure-classification.mjs";
import {
  ADVISORY_LINT_NOTE,
  buildPlanFailureContent,
  buildPlanSetupFailureContent,
  buildPlanStepCrashFailureContent,
  buildPlanSummaryMarkdown,
  buildWarningAnnotation,
  formatMigrationSection,
  sanitizeExternalPlanText,
} from "../scripts/deploy-production/messages.mjs";
import {
  executePlanSetupSoftFail,
  executePlanSoftFail,
  executePlanStepCrashSoftFail,
} from "../scripts/deploy-production/plan-soft-fail.mjs";
import {
  escapeForWorkflowCommand,
  emitWorkflowWarning,
} from "../scripts/deploy-production/workflow-output.mjs";

describe("deploy-production baseline (unit)", () => {
  const deployments = [
    { id: 3, sha: "ccc" },
    { id: 2, sha: "bbb" },
    { id: 1, sha: "aaa" },
  ];

  it("uses newest successful deployment", () => {
    const statuses: Record<number, string> = {
      3: "failure",
      2: "success",
      1: "success",
    };
    expect(pickBaselineShaFromDeployments(deployments, (id) => statuses[id])).toBe(
      "bbb",
    );
  });

  it("skips newer pending or failed deployments", () => {
    const statuses: Record<number, string> = {
      3: "pending",
      2: "in_progress",
      1: "success",
    };
    expect(pickBaselineShaFromDeployments(deployments, (id) => statuses[id])).toBe(
      "aaa",
    );
  });

  it("returns null when no successful deployment exists", () => {
    const statuses: Record<number, string> = {
      3: "failure",
      2: "queued",
      1: "inactive",
    };
    expect(
      pickBaselineShaFromDeployments(deployments, (id) => statuses[id]),
    ).toBeNull();
  });

  it("recognizes success status", () => {
    expect(isSuccessfulDeploymentStatus("success")).toBe(true);
    expect(isSuccessfulDeploymentStatus("failure")).toBe(false);
  });
});

describe("deploy-production isMigrationSqlPath (unit)", () => {
  it("accepts top-level migration files only", () => {
    expect(isMigrationSqlPath("migrations/0001_a.sql")).toBe(true);
    expect(isMigrationSqlPath("migrations/.sql")).toBe(false);
    expect(isMigrationSqlPath("migrations/sub/x.sql")).toBe(false);
  });
});

describe("deploy-production compare pages (unit)", () => {
  it("merges files from every compare page and keeps metadata from the first", () => {
    const page1 = {
      status: "ahead",
      ahead_by: 2,
      behind_by: 0,
      files: [{ filename: "migrations/0001_a.sql", status: "added" }],
    };
    const page2 = {
      status: "ahead",
      ahead_by: 2,
      behind_by: 0,
      files: [{ filename: "src/other.ts", status: "modified" }],
    };
    const page3 = {
      status: "ahead",
      ahead_by: 2,
      behind_by: 0,
      files: [{ filename: "migrations/0002_b.sql", status: "added" }],
    };
    const merged = mergeCompareApiPages([page1, page2, page3]);
    expect(merged?.status).toBe("ahead");
    expect(merged?.totalFileCount).toBe(3);
    expect(merged?.files).toHaveLength(3);
    expect(collectComparePages([page1, page2, page3])).toHaveLength(3);
  });

  it("does not lose a migration on page 1 when three pages are returned", () => {
    const pages = [
      {
        status: "ahead",
        ahead_by: 1,
        behind_by: 0,
        files: [{ filename: "migrations/0009_new.sql", status: "added" }],
      },
      { status: "ahead", ahead_by: 1, behind_by: 0, files: [] },
      { status: "ahead", ahead_by: 1, behind_by: 0, files: [] },
    ];
    const merged = mergeCompareApiPages(pages);
    const plan = decideMigrationPlan({
      baselineSha: "base",
      compare: {
        status: merged?.status,
        ahead_by: merged?.ahead_by,
        behind_by: merged?.behind_by,
        files: merged?.files.map((f) => ({
          filename: (f as { filename: string }).filename,
          status: (f as { status: string }).status,
        })),
        totalFileCount: merged?.totalFileCount,
      },
      allMigrationPathsAtHead: ["migrations/0009_new.sql"],
    });
    expect(plan.mode).toBe("compare");
    expect(plan.migrations).toEqual([
      { path: "migrations/0009_new.sql", changeKind: "added" },
    ]);
  });

  it("fires cap fallback on total merged file count", () => {
    const files = Array.from({ length: GITHUB_COMPARE_CHANGED_FILES_CAP }, (_, i) => ({
      filename: `src/file-${i}.ts`,
      status: "modified",
    }));
    const plan = decideMigrationPlan({
      baselineSha: "base",
      compare: {
        status: "ahead",
        ahead_by: 1,
        behind_by: 0,
        files: files.slice(0, 10),
        totalFileCount: GITHUB_COMPARE_CHANGED_FILES_CAP,
      },
      allMigrationPathsAtHead: ["migrations/0001_a.sql"],
    });
    expect(plan.mode).toBe("list_all");
    expect(plan.fallbackReason).toBe(
      "Compare result may be truncated, listing all migrations",
    );
  });
});

describe("deploy-production compare migrations (unit)", () => {
  const allAtHead = [
    "migrations/0001_a.sql",
    "migrations/0002_b.sql",
    "migrations/0003_c.sql",
  ];

  it("lists all migrations when there is no baseline", () => {
    const plan = decideMigrationPlan({
      baselineSha: null,
      compare: null,
      allMigrationPathsAtHead: allAtHead,
    });
    expect(plan.mode).toBe("list_all");
    expect(plan.fallbackReason).toContain(
      "No previous successful production deployment",
    );
    expect(plan.migrations.map((m) => m.path)).toEqual(allAtHead);
  });

  it("selects one new migration from a clean ahead compare", () => {
    const plan = decideMigrationPlan({
      baselineSha: "base111",
      compare: {
        status: "ahead",
        ahead_by: 1,
        behind_by: 0,
        files: [{ filename: "migrations/0002_b.sql", status: "added" }],
        totalFileCount: 1,
      },
      allMigrationPathsAtHead: allAtHead,
    });
    expect(plan.mode).toBe("compare");
    expect(plan.migrations).toEqual([
      { path: "migrations/0002_b.sql", changeKind: "added" },
    ]);
  });

  it("flags changed (modified) migrations", () => {
    const changes = selectMigrationChangesFromCompare([
      { filename: "migrations/0002_b.sql", status: "modified" },
    ]);
    expect(changes).toEqual([
      { path: "migrations/0002_b.sql", changeKind: "changed", previousPath: undefined },
    ]);
  });

  it("reports no migrations in this deploy for identical compare", () => {
    const plan = decideMigrationPlan({
      baselineSha: "same",
      compare: {
        status: "identical",
        ahead_by: 0,
        behind_by: 0,
        files: [],
        totalFileCount: 0,
      },
      allMigrationPathsAtHead: allAtHead,
    });
    expect(plan.mode).toBe("compare");
    expect(plan.migrations).toHaveLength(0);
  });

  it("falls back when compare is not ahead-only", () => {
    const plan = decideMigrationPlan({
      baselineSha: "base",
      compare: {
        status: "behind",
        ahead_by: 0,
        behind_by: 2,
        files: [],
        totalFileCount: 0,
      },
      allMigrationPathsAtHead: allAtHead,
    });
    expect(plan.mode).toBe("list_all");
    expect(plan.fallbackReason).toContain("not a clean ahead-only history");
  });

  it("falls back at compare file cap boundary", () => {
    const files = Array.from({ length: GITHUB_COMPARE_CHANGED_FILES_CAP }, (_, i) => ({
      filename: `src/file-${i}.ts`,
      status: "modified",
    }));
    expect(isCompareFileListNearCap(files.length)).toBe(true);
    const plan = decideMigrationPlan({
      baselineSha: "base",
      compare: {
        status: "ahead",
        ahead_by: 1,
        behind_by: 0,
        files,
        totalFileCount: files.length,
      },
      allMigrationPathsAtHead: allAtHead,
    });
    expect(plan.mode).toBe("list_all");
    expect(plan.fallbackReason).toBe(
      "Compare result may be truncated, listing all migrations",
    );
  });

  it("treats diverged history as fallback", () => {
    expect(isCleanAheadCompare({ status: "diverged" })).toBe(false);
  });
});

describe("deploy-production failure classification (unit)", () => {
  const cases = [
    {
      name: "HTTP 500",
      error: new Error("gh: Server Error (HTTP 500)"),
      category: "github_unavailable",
    },
    {
      name: "HTTP 429",
      error: new Error("gh: Too Many Requests (HTTP 429)"),
      category: "github_unavailable",
    },
    {
      name: "HTTP 403 rate limit",
      error: new Error("gh: API rate limit exceeded (HTTP 403)"),
      category: "github_unavailable",
    },
    {
      name: "network ETIMEDOUT",
      error: Object.assign(new Error("spawn ETIMEDOUT"), { code: "ETIMEDOUT" }),
      category: "github_unavailable",
    },
    {
      name: "HTTP 401",
      error: new Error("gh: Bad credentials (HTTP 401)"),
      category: "access_or_config",
    },
    {
      name: "HTTP 403 not rate limit",
      error: new Error("gh: Resource not accessible by integration (HTTP 403)"),
      category: "access_or_config",
    },
    {
      name: "HTTP 404 deployments",
      error: new Error(
        "gh: Not Found (HTTP 404): GET https://api.github.com/repos/o/r/deployments",
      ),
      category: "access_or_config",
    },
    {
      name: "HTTP 404 compare",
      error: new Error("gh: Not Found (HTTP 404): repos/o/r/compare/base...head"),
      category: "access_or_config",
    },
    {
      name: "TypeError defaults to bug",
      error: new TypeError("Cannot read properties of undefined"),
      category: "bug",
    },
    {
      name: "TypeError mentioning network stays bug",
      error: new TypeError("network is not a function"),
      category: "bug",
    },
    {
      name: "dial tcp message",
      error: new Error("dial tcp: lookup api.github.com: i/o timeout"),
      category: "github_unavailable",
    },
    {
      name: "JSON parse defaults to bug",
      error: new SyntaxError("Unexpected token in JSON"),
      category: "bug",
    },
    {
      name: "HTTP 404 unrelated defaults to bug",
      error: new Error("gh: Not Found (HTTP 404): some/other/path"),
      category: "bug",
    },
  ];

  for (const { name, error, category } of cases) {
    it(`classifies ${name} as ${category}`, () => {
      expect(classifyPlanFailure(error).category).toBe(category);
    });
  }

  it("failure messages never contain no-migrations wording", () => {
    for (const category of ["github_unavailable", "access_or_config", "bug"] as const) {
      const { summaryMarkdown, warningAnnotation } = buildPlanFailureContent({
        category,
        detail: "example detail",
      });
      expect(summaryMarkdown).not.toContain("No migrations in this deploy");
      expect(warningAnnotation).not.toContain("No migrations in this deploy");
    }
  });

  it("uses exact github_unavailable headline wording", () => {
    const { warningAnnotation } = buildPlanFailureContent({
      category: "github_unavailable",
      detail: "HTTP 503",
    });
    expect(warningAnnotation).toBe("PLAN UNAVAILABLE: GitHub API problem (HTTP 503).");
  });

  it("classifies real execFileSync gh stderr failures", () => {
    try {
      execFileSync(
        "node",
        [
          "-e",
          'process.stderr.write("gh: Server Error (HTTP 502)\\n"); process.exit(1);',
        ],
        { encoding: "utf8" },
      );
      expect.fail("expected child process to throw");
    } catch (error) {
      expect(classifyPlanFailure(error).category).toBe("github_unavailable");
      const err = error as { stderr?: unknown; message?: string };
      expect(typeof err.stderr === "string" || Buffer.isBuffer(err.stderr)).toBe(true);
    }
  });
});

describe("deploy-production soft fail (unit)", () => {
  it("returns exit 0 for each failure category", () => {
    const errors = [
      new Error("gh: Server Error (HTTP 500)"),
      new Error("gh: Bad credentials (HTTP 401)"),
      new TypeError("broken"),
    ];
    for (const error of errors) {
      const result = executePlanSoftFail(error);
      expect(result.exitCode).toBe(0);
      expect(result.summaryMarkdown).toContain("Production D1 migration plan");
      expect(result.warningAnnotation).toMatch(/^PLAN (UNAVAILABLE|FAILED):/);
    }
  });

  it("returns exit 0 when the plan step crashes path is used", () => {
    expect(executePlanStepCrashSoftFail().exitCode).toBe(0);
  });

  it("returns exit 0 for setup step failure reporting", () => {
    expect(executePlanSetupSoftFail("npm-ci").exitCode).toBe(0);
  });
});

describe("deploy-production advisory lint (unit)", () => {
  it("returns warnings for disallowed SQL without throwing", () => {
    const warnings = collectAdvisoryLintWarnings(
      "migrations/0009_bad.sql",
      "DROP TABLE cards;",
    );
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain("0009_bad.sql");
  });

  it("returns no warnings for expand-only SQL", () => {
    expect(
      collectAdvisoryLintWarnings(
        "migrations/0010_ok.sql",
        "CREATE TABLE IF NOT EXISTS t (id INTEGER PRIMARY KEY);",
      ),
    ).toEqual([]);
  });
});

describe("deploy-production messages (unit)", () => {
  const basePlan = {
    headSha: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    baselineSha: "cafebabecafebabecafebabecafebabecafebabe",
    plan: {
      mode: "compare" as const,
      migrations: [] as { path: string; changeKind: "added" }[],
    },
    migrationSections: [] as string[],
  };

  it('summary says "No migrations in this deploy" for zero migrations', () => {
    const summary = buildPlanSummaryMarkdown(basePlan);
    expect(summary).toContain("**No migrations in this deploy.**");
    expect(summary).toContain(ADVISORY_LINT_NOTE);
    expect(summary).toContain("shared non-prod database");
  });

  it("summary lists exactly one migration with count line", () => {
    const section = formatMigrationSection({
      path: "migrations/0002_add.sql",
      changeKind: "added",
      introduction: "Last changed in: commit `abc`",
      sql: "SELECT 1;",
      lintWarnings: [],
    });
    const summary = buildPlanSummaryMarkdown({
      ...basePlan,
      plan: {
        mode: "compare",
        migrations: [{ path: "migrations/0002_add.sql", changeKind: "added" }],
      },
      migrationSections: [section],
    });
    expect(summary).toContain("**Migrations in this deploy (1):**");
    expect(summary).toContain("0002_add.sql");
  });

  it("summary lists three migrations with count line", () => {
    const paths = [
      "migrations/0001_a.sql",
      "migrations/0002_b.sql",
      "migrations/0003_c.sql",
    ];
    const summary = buildPlanSummaryMarkdown({
      ...basePlan,
      plan: {
        mode: "compare",
        migrations: paths.map((path) => ({ path, changeKind: "added" as const })),
      },
      migrationSections: paths.map((path) =>
        formatMigrationSection({
          path,
          changeKind: "added",
          introduction: "Last changed in: unknown",
          sql: "SELECT 1;",
          lintWarnings: [],
        }),
      ),
    });
    expect(summary).toContain("**Migrations in this deploy (3):**");
    expect(summary).toContain("0003_c.sql");
  });

  it("builds warning annotation for one migration", () => {
    expect(
      buildWarningAnnotation({ migrationPaths: ["migrations/0002_add.sql"] }),
    ).toBe("This deploy includes 1 migration: migrations/0002_add.sql");
  });

  it("builds warning annotation for three migrations", () => {
    const paths = [
      "migrations/0001_a.sql",
      "migrations/0002_b.sql",
      "migrations/0003_c.sql",
    ];
    const line = buildWarningAnnotation({ migrationPaths: paths });
    expect(line).toContain("3 migrations");
    expect(line).toContain("0001_a.sql");
    expect(line).toContain("0003_c.sql");
  });

  it("returns null annotation for zero migrations", () => {
    expect(buildWarningAnnotation({ migrationPaths: [] })).toBeNull();
  });

  it("flags changed migrations clearly in the rendered section", () => {
    const section = formatMigrationSection({
      path: "migrations/0002_b.sql",
      changeKind: "changed",
      introduction: "Last changed in: commit `abc`",
      sql: "SELECT 1;",
      lintWarnings: [],
    });
    expect(section).toContain("**Changed** (not a new file)");
  });

  it("sanitizes adversarial file and PR names in sections", () => {
    const evilPath = "migrations/`injected`.sql\n::error::owned";
    const section = formatMigrationSection({
      path: evilPath,
      changeKind: "added",
      introduction: formatMigrationIntroduction({
        commitSha: "abc123def456",
        prNumber: 99,
        prTitle: "`title`\n::warning::x <!--x-->",
      }),
      sql: "SELECT 1;",
      lintWarnings: [],
    });
    expect(section).not.toContain("::error::");
    expect(section).not.toContain("::warning::");
    expect(section).not.toContain("`injected`");
    expect(section).not.toContain("<!--");
    expect(sanitizeExternalPlanText("a::b")).not.toContain("::");
  });

  it("sanitizes adversarial migration names when emitted as workflow warnings", () => {
    const line = buildWarningAnnotation({
      migrationPaths: ["migrations/x.sql\n::error::x", "migrations/`y`.sql"],
    });
    expect(line).not.toBeNull();
    const logs: string[] = [];
    const original = console.log;
    console.log = (msg: string) => {
      logs.push(msg);
    };
    emitWorkflowWarning(line!);
    console.log = original;
    expect(logs[0]).not.toContain("::error::");
    expect(logs[0]).not.toContain("\n");
  });

  it("escapes workflow command injection in annotations", () => {
    const escaped = escapeForWorkflowCommand("a%b\nc::d");
    expect(escaped).not.toContain("\n");
    expect(escaped).toContain("%25");
    const logs: string[] = [];
    const original = console.log;
    console.log = (msg: string) => {
      logs.push(msg);
    };
    emitWorkflowWarning("a%b\nc::d");
    console.log = original;
    expect(logs[0]).not.toContain("::error::");
    expect(logs[0]).not.toMatch(/\n/);
    expect(logs[0]).toContain("%25");
  });

  it("emitWorkflowWarning escapes percent and newlines", () => {
    const logs: string[] = [];
    const original = console.log;
    console.log = (line: string) => {
      logs.push(line);
    };
    emitWorkflowWarning("x%0A::error::");
    console.log = original;
    expect(logs[0]).toBe("::warning::x%250A⸨⸩error⸨⸩");
  });

  it("uses Last changed in label in attribution", () => {
    expect(formatMigrationIntroduction({ commitSha: "abc123def456" })).toContain(
      "Last changed in:",
    );
  });

  it("uses exact setup failure wording", () => {
    const { warningAnnotation, summaryMarkdown } =
      buildPlanSetupFailureContent("npm-ci");
    expect(warningAnnotation).toBe(
      "PLAN FAILED: setup step npm-ci failed before the plan could run.",
    );
    expect(summaryMarkdown).toContain(
      "If the step log shows a GitHub or npm outage, it is probably fine to approve",
    );
  });

  it("uses exact plan step crash wording", () => {
    const { warningAnnotation } = buildPlanStepCrashFailureContent();
    expect(warningAnnotation).toBe(
      "PLAN FAILED: plan step crashed or timed out before finishing.",
    );
  });
});

describe("deploy-production gh error shape (unit)", () => {
  it("reads HTTP status from gh-style Error.message", () => {
    const err = new Error("gh: Server Error (HTTP 502)");
    expect(errorToDiagnosticText(err)).toContain("HTTP 502");
    expect(classifyPlanFailure(err).category).toBe("github_unavailable");
  });
});
