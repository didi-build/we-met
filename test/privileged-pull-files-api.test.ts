import { describe, expect, it } from "vitest";
import {
  flattenPullFilesPayload,
  normalizePullFileEntry,
  parsePullRequestFilesApiStdout,
  shouldFetchWorkflowFileContent,
} from "../scripts/lib/privileged-pull-files-api.mjs";

describe("privileged-pull-files-api (unit)", () => {
  it("parses pretty-printed single JSON array (whole-output parse)", () => {
    const stdout = `[
  { "filename": "a.txt", "status": "modified" },
  { "filename": "b.txt", "status": "added" }
]`;
    expect(parsePullRequestFilesApiStdout(stdout)).toEqual([
      { filename: "a.txt", status: "modified" },
      { filename: "b.txt", status: "added" },
    ]);
  });

  it("parses a flat JSON array", () => {
    const stdout = JSON.stringify([
      { filename: "a.txt", status: "modified" },
      { filename: "b.txt", status: "added" },
    ]);
    expect(parsePullRequestFilesApiStdout(stdout)).toEqual([
      { filename: "a.txt", status: "modified" },
      { filename: "b.txt", status: "added" },
    ]);
  });

  it("parses slurped single page ([[...]])", () => {
    const page = [
      { filename: "a.txt", status: "modified" },
      { filename: "b.txt", status: "added" },
    ];
    const stdout = JSON.stringify([page]);
    expect(parsePullRequestFilesApiStdout(stdout)).toEqual(page);
  });

  it("parses slurped two pages", () => {
    const page1 = [{ filename: "one.ts", status: "modified" }];
    const page2 = [{ filename: "two.ts", status: "added" }];
    const stdout = JSON.stringify([page1, page2]);
    expect(parsePullRequestFilesApiStdout(stdout)).toEqual([
      { filename: "one.ts", status: "modified" },
      { filename: "two.ts", status: "added" },
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

  it("throws when an entry is missing filename", () => {
    expect(() => normalizePullFileEntry({ status: "modified" }, 0)).toThrow(
      /missing string filename/,
    );
    expect(() =>
      parsePullRequestFilesApiStdout(JSON.stringify([{ status: "added" }])),
    ).toThrow(/missing string filename/);
  });

  it("flattenPullFilesPayload leaves non-nested arrays unchanged", () => {
    const flat = [{ filename: "x", status: "modified" }];
    expect(flattenPullFilesPayload(flat)).toEqual(flat);
  });

  it("skips workflow content fetch for removed files only", () => {
    expect(shouldFetchWorkflowFileContent("removed")).toBe(false);
    expect(shouldFetchWorkflowFileContent("renamed")).toBe(true);
    expect(shouldFetchWorkflowFileContent("modified")).toBe(true);
  });
});
