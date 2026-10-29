import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";
import {
  EXPECTED_WORKFLOW_PERMISSIONS,
  extractWorkflowPermissionsMaps,
  normalizePermissionsValue,
  permissionsMapEquals,
  workflowPermissionsAllowOnly,
} from "../scripts/lib/workflow-permissions-parse.mjs";

describe("workflow-permissions-parse (unit)", () => {
  it("accepts workflow-level block permissions contents read", () => {
    const yaml = `
permissions:
  contents: read
jobs:
  x:
    runs-on: ubuntu-latest
`;
    expect(workflowPermissionsAllowOnly(yaml, EXPECTED_WORKFLOW_PERMISSIONS)).toBe(
      true,
    );
  });

  it("rejects job-level permissions write-all scalar", () => {
    const yaml = `
permissions:
  contents: read
jobs:
  x:
    runs-on: ubuntu-latest
    permissions: write-all
`;
    expect(workflowPermissionsAllowOnly(yaml, EXPECTED_WORKFLOW_PERMISSIONS)).toBe(
      false,
    );
  });

  it("rejects job-level inline map with extra keys", () => {
    const yaml = `
permissions:
  contents: read
jobs:
  x:
    runs-on: ubuntu-latest
    permissions: { contents: read, actions: write }
`;
    const maps = extractWorkflowPermissionsMaps(yaml);
    expect(maps.some((map) => permissionsMapEquals(map, { contents: "read" }))).toBe(
      true,
    );
    expect(workflowPermissionsAllowOnly(yaml, EXPECTED_WORKFLOW_PERMISSIONS)).toBe(
      false,
    );
  });

  it("rejects permissions values with trailing comments", () => {
    const yaml = `
permissions:
  contents: read
jobs:
  x:
    runs-on: ubuntu-latest
    permissions:
      actions: write # comment
`;
    expect(workflowPermissionsAllowOnly(yaml, EXPECTED_WORKFLOW_PERMISSIONS)).toBe(
      false,
    );
  });

  it("rejects quoted permission values that are not read", () => {
    const yaml = `
permissions:
  contents: "write"
jobs:
  x:
    runs-on: ubuntu-latest
`;
    expect(workflowPermissionsAllowOnly(yaml, EXPECTED_WORKFLOW_PERMISSIONS)).toBe(
      false,
    );
  });

  it("rejects workflow-level permissions write-all scalar", () => {
    const yaml = `
permissions: write-all
jobs:
  x:
    runs-on: ubuntu-latest
`;
    expect(workflowPermissionsAllowOnly(yaml, EXPECTED_WORKFLOW_PERMISSIONS)).toBe(
      false,
    );
  });

  it("rejects when permissions exist only on one job and a second job has none", () => {
    const yaml = `
jobs:
  first:
    runs-on: ubuntu-latest
    permissions:
      contents: read
  second:
    runs-on: ubuntu-latest
`;
    expect(workflowPermissionsAllowOnly(yaml, EXPECTED_WORKFLOW_PERMISSIONS)).toBe(
      false,
    );
    expect(extractWorkflowPermissionsMaps(yaml)).toEqual([]);
  });

  it("rejects null workflow permissions", () => {
    const yaml = `
permissions:
jobs:
  x:
    runs-on: ubuntu-latest
`;
    expect(workflowPermissionsAllowOnly(yaml, EXPECTED_WORKFLOW_PERMISSIONS)).toBe(
      false,
    );
    expect(extractWorkflowPermissionsMaps(yaml)).toEqual([]);
  });

  it("rejects null job permissions", () => {
    const yaml = `
permissions:
  contents: read
jobs:
  x:
    runs-on: ubuntu-latest
    permissions:
`;
    expect(workflowPermissionsAllowOnly(yaml, EXPECTED_WORKFLOW_PERMISSIONS)).toBe(
      false,
    );
    expect(extractWorkflowPermissionsMaps(yaml)).toEqual([]);
  });

  it("rejects permission map entries with null values", () => {
    const yaml = `
permissions:
  contents: read
  actions:
jobs:
  x:
    runs-on: ubuntu-latest
`;
    expect(workflowPermissionsAllowOnly(yaml, EXPECTED_WORKFLOW_PERMISSIONS)).toBe(
      false,
    );
    expect(extractWorkflowPermissionsMaps(yaml)).toEqual([]);
  });

  it("checks every job with explicit permissions, not only the first", () => {
    const yaml = `
permissions:
  contents: read
jobs:
  ok:
    runs-on: ubuntu-latest
    permissions:
      contents: read
  bad:
    runs-on: ubuntu-latest
    permissions:
      contents: write
`;
    expect(workflowPermissionsAllowOnly(yaml, EXPECTED_WORKFLOW_PERMISSIONS)).toBe(
      false,
    );
    const maps = extractWorkflowPermissionsMaps(yaml);
    expect(maps).toHaveLength(3);
    expect(maps.every((map) => permissionsMapEquals(map, { contents: "read" }))).toBe(
      false,
    );
  });

  it("returns empty maps for non-object documents", () => {
    expect(extractWorkflowPermissionsMaps("just a string")).toEqual([]);
    expect(extractWorkflowPermissionsMaps("[]")).toEqual([]);
  });

  it("treats permission arrays as invalid", () => {
    expect(normalizePermissionsValue(["contents: read"])).toBeNull();
    const yaml = `
permissions:
  - contents: read
jobs:
  x:
    runs-on: ubuntu-latest
`;
    expect(workflowPermissionsAllowOnly(yaml, EXPECTED_WORKFLOW_PERMISSIONS)).toBe(
      false,
    );
    expect(extractWorkflowPermissionsMaps(yaml)).toEqual([]);
  });

  it("requires a workflow-level permissions key in every checked-in workflow file", () => {
    const dir = join(process.cwd(), ".github/workflows");
    const files = readdirSync(dir).filter((name) => name.endsWith(".yml"));
    expect(files.length).toBe(12);
    for (const file of files) {
      const content = readFileSync(join(dir, file), "utf8");
      const doc = parseYaml(content);
      expect(doc && typeof doc === "object" && "permissions" in doc, file).toBe(true);
    }
  });
});
