import { describe, expect, it } from "vitest";
import {
  EXPECTED_WORKFLOW_PERMISSIONS,
  extractWorkflowPermissionsMaps,
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
});
