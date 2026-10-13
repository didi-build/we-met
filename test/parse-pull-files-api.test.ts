import { describe, expect, it } from "vitest";
import {
  parsePullRequestFilesApiStdout,
  shouldFetchWorkflowFileContent,
} from "../scripts/lib/parse-pull-files-api.mjs";

describe("parse-pull-files-api (unit)", () => {
  it("parses a single slurped JSON array", () => {
    const stdout = JSON.stringify([
      { filename: "a.txt", status: "modified" },
      { filename: "b.txt", status: "added" },
    ]);
    expect(parsePullRequestFilesApiStdout(stdout)).toEqual([
      { filename: "a.txt", status: "modified" },
      { filename: "b.txt", status: "added" },
    ]);
  });

  it("parses two paginated pages (one array per line)", () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      filename: `src/file-${i}.ts`,
      status: "modified",
    }));
    const page2 = [{ filename: "src/file-100.ts", status: "added" }];
    const stdout = `${JSON.stringify(page1)}\n${JSON.stringify(page2)}`;
    const files = parsePullRequestFilesApiStdout(stdout);
    expect(files).toHaveLength(101);
    expect(files[100]).toEqual({ filename: "src/file-100.ts", status: "added" });
  });

  it("skips workflow content fetch for removed files only", () => {
    expect(shouldFetchWorkflowFileContent("removed")).toBe(false);
    expect(shouldFetchWorkflowFileContent("renamed")).toBe(true);
    expect(shouldFetchWorkflowFileContent("modified")).toBe(true);
  });
});
