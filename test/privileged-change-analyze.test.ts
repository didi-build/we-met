import { describe, expect, it } from "vitest";
import {
  analyzePrivilegedChange,
  privilegedChangeCheckState,
} from "../scripts/lib/privileged-change-analyze.mjs";
import { isPrivilegedFlagInfrastructurePath } from "../scripts/lib/privileged-paths.mjs";

describe("privileged-change-analyze (unit)", () => {
  it("flags privileged wrangler config without workflow findings", () => {
    const result = analyzePrivilegedChange(
      [{ filename: "wrangler.jsonc", status: "modified" }],
      {},
      { trustedOrg: "didi-build" },
    );
    expect(result.flagged).toBe(true);
    expect(result.privilegedFiles).toEqual(["wrangler.jsonc"]);
    expect(result.findings).toEqual([]);
  });

  it("marks new workflow and migrate-nonprod as high severity", () => {
    const workflow = `name: X
on:
  workflow_dispatch:
jobs:
  j:
    runs-on: ubuntu-latest
    environment: migrate-nonprod
    steps:
      - run: echo ok
`;
    const result = analyzePrivilegedChange(
      [
        {
          filename: ".github/workflows/migrate.yml",
          status: "added",
        },
      ],
      { ".github/workflows/migrate.yml": workflow },
      { trustedOrg: "didi-build" },
    );
    expect(result.flagged).toBe(true);
    expect(result.findings.some((f) => f.message.includes("New workflow"))).toBe(true);
    expect(result.findings.some((f) => f.message.includes("migrate-nonprod"))).toBe(
      true,
    );
  });

  it("flags infrastructure edits to privileged pull-files parser", () => {
    const result = analyzePrivilegedChange(
      [{ filename: "scripts/lib/privileged-pull-files-api.mjs", status: "modified" }],
      {},
      { trustedOrg: "didi-build" },
    );
    expect(result.flagged).toBe(true);
    expect(
      result.findings.some((f) =>
        f.message.includes("Changes privileged-change flag infrastructure"),
      ),
    ).toBe(true);
    expect(
      result.findings.some((f) => f.message.includes("privileged-pull-files-api.mjs")),
    ).toBe(true);
  });

  it("flags infrastructure when privileged-paths.mjs is renamed to a docs path", () => {
    const changed = [
      {
        filename: "docs/architecture/privileged-paths-archived.md",
        status: "renamed" as const,
        previous_filename: "scripts/lib/privileged-paths.mjs",
      },
    ];
    expect(isPrivilegedFlagInfrastructurePath(changed[0].filename)).toBe(false);
    const result = analyzePrivilegedChange(changed, {}, { trustedOrg: "didi-build" });
    expect(
      result.findings.some(
        (f) =>
          f.severity === "high" &&
          f.message ===
            "Changes privileged-change flag infrastructure (scripts/lib/privileged-paths.mjs)",
      ),
    ).toBe(true);
  });

  const stagingActivationInfrastructurePaths = [
    "scripts/lib/workflow-permissions-parse.mjs",
    "scripts/activate-staging-account.mjs",
    "scripts/lib/activate-staging-account.mjs",
    "scripts/lib/wrangler-placeholders.mjs",
    "scripts/lib/parse-jsonc.mjs",
    "scripts/apply-migrations.mjs",
    "migrations/0001_card_lookup_schema.sql",
    "scripts/dry-run-generated-config.mjs",
  ] as const;

  for (const filename of stagingActivationInfrastructurePaths) {
    it(`flags infrastructure edits to ${filename}`, () => {
      const result = analyzePrivilegedChange(
        [{ filename, status: "modified" }],
        {},
        { trustedOrg: "didi-build" },
      );
      expect(result.flagged).toBe(true);
      expect(
        result.findings.some(
          (f) =>
            f.severity === "high" &&
            f.message.includes("Changes privileged-change flag infrastructure") &&
            f.message.includes(filename),
        ),
      ).toBe(true);
    });
  }

  it("check state succeeds when reviewed label present", () => {
    expect(privilegedChangeCheckState(true, [])).toBe("failure");
    expect(privilegedChangeCheckState(true, ["privileged-change-reviewed"])).toBe(
      "success",
    );
    expect(privilegedChangeCheckState(false, [])).toBe("success");
  });
});
