import { describe, expect, it } from "vitest";
import {
  isSuccessfulDeploymentStatus,
  pickBaselineShaFromDeployments,
} from "../scripts/deploy-production/baseline.mjs";
import {
  decideMigrationPlan,
  GITHUB_COMPARE_CHANGED_FILES_CAP,
  isCleanAheadCompare,
  isCompareFileListNearCap,
  selectMigrationChangesFromCompare,
} from "../scripts/deploy-production/compare-migrations.mjs";
import { formatMigrationIntroduction } from "../scripts/deploy-production/attribution.mjs";
import { collectAdvisoryLintWarnings } from "../scripts/deploy-production/advisory-lint";
import { resolvePlanExitCode } from "../scripts/deploy-production/exit-code.mjs";
import {
  ADVISORY_LINT_NOTE,
  buildPlanSummaryMarkdown,
  buildWarningAnnotation,
  formatMigrationSection,
  sanitizeExternalPlanText,
} from "../scripts/deploy-production/messages.mjs";

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
      compare: { status: "ahead", ahead_by: 1, behind_by: 0, files },
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

  it("does not change exit code when lint warnings are present", () => {
    const warnings = collectAdvisoryLintWarnings(
      "migrations/0009_bad.sql",
      "DROP TABLE cards;",
    );
    expect(warnings.length).toBeGreaterThan(0);
    expect(resolvePlanExitCode({ lintWarningCount: warnings.length })).toBe(0);
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
});
