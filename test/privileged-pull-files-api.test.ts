import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  flattenPullFilesPayload,
  normalizePullFileEntry,
  parseGhApiPaginatedSlurpedStdout,
  parsePullRequestFilesApiStdout,
  pathsConsideredForPrivilegedGate,
  privilegedFilenamesFromChangedFiles,
  shouldFetchWorkflowFileContent,
} from "../scripts/lib/privileged-pull-files-api.mjs";
import { isPrivilegedPath } from "../scripts/lib/privileged-paths.mjs";
import { analyzePrivilegedChange } from "../scripts/lib/privileged-change-analyze.mjs";

const FIXTURES = "test/fixtures/privileged-pull-files-api";

function readFixture(name: string) {
  return readFileSync(`${FIXTURES}/${name}`, "utf8");
}

describe("privileged-pull-files-api (unit)", () => {
  it("parses two-page slurped issue comments", () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      body: `comment ${i}`,
      user: { login: "user" },
    }));
    const page2 = [
      {
        id: 101,
        body: "<!-- we-met-migrate-nonprod -->",
        user: { login: "github-actions[bot]" },
      },
    ];
    const stdout = JSON.stringify([page1, page2]);
    const flat = parseGhApiPaginatedSlurpedStdout(stdout);
    expect(flat).toHaveLength(101);
    expect(flat[100]).toEqual(page2[0]);
  });

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

  it("keeps previous_filename on renamed pull file entries", () => {
    const stdout = readFixture("rename-privileged-to-unlisted.json");
    expect(parsePullRequestFilesApiStdout(stdout)).toEqual([
      {
        filename: "docs/runbooks/renamed-wrangler-note.md",
        status: "renamed",
        previous_filename: "wrangler.jsonc",
      },
    ]);
  });

  it("flags a rename out of a privileged path via previous_filename", () => {
    const changed = parsePullRequestFilesApiStdout(
      readFixture("rename-privileged-to-unlisted.json"),
    );
    expect(privilegedFilenamesFromChangedFiles(changed, isPrivilegedPath)).toEqual([
      "wrangler.jsonc",
    ]);
    const analysis = analyzePrivilegedChange(changed, {}, { trustedOrg: "didi-build" });
    expect(analysis.flagged).toBe(true);
    expect(analysis.privilegedFiles).toEqual(["wrangler.jsonc"]);
  });

  it("flags a rename into a privileged path via filename", () => {
    const changed = parsePullRequestFilesApiStdout(
      readFixture("rename-unlisted-to-privileged.json"),
    );
    expect(privilegedFilenamesFromChangedFiles(changed, isPrivilegedPath)).toEqual([
      "wrangler.jsonc",
    ]);
    const analysis = analyzePrivilegedChange(changed, {}, { trustedOrg: "didi-build" });
    expect(analysis.flagged).toBe(true);
    expect(analysis.privilegedFiles).toEqual(["wrangler.jsonc"]);
  });

  it("does not flag a rename between two unlisted paths", () => {
    const changed = parsePullRequestFilesApiStdout(
      readFixture("rename-unlisted-to-unlisted.json"),
    );
    expect(privilegedFilenamesFromChangedFiles(changed, isPrivilegedPath)).toEqual([]);
    const analysis = analyzePrivilegedChange(changed, {}, { trustedOrg: "didi-build" });
    expect(analysis.flagged).toBe(false);
    expect(analysis.privilegedFiles).toEqual([]);
  });

  it("flags renamed entry without previous_filename when the new path is privileged", () => {
    const fromApi = normalizePullFileEntry(
      { filename: "wrangler.jsonc", status: "renamed" },
      0,
    );
    expect(fromApi.previous_filename).toBeUndefined();
    expect(privilegedFilenamesFromChangedFiles([fromApi], isPrivilegedPath)).toEqual([
      "wrangler.jsonc",
    ]);

    const emptyPrevious = normalizePullFileEntry(
      { filename: "wrangler.jsonc", status: "renamed", previous_filename: "" },
      0,
    );
    expect(emptyPrevious.previous_filename).toBeUndefined();
    expect(
      privilegedFilenamesFromChangedFiles([emptyPrevious], isPrivilegedPath),
    ).toEqual(["wrangler.jsonc"]);

    const nonStringPrevious = normalizePullFileEntry(
      { filename: "wrangler.jsonc", status: "renamed", previous_filename: null },
      0,
    );
    expect(nonStringPrevious.previous_filename).toBeUndefined();
    expect(
      privilegedFilenamesFromChangedFiles([nonStringPrevious], isPrivilegedPath),
    ).toEqual(["wrangler.jsonc"]);
  });

  it("normalizePullFileEntry drops previous_filename unless status is renamed", () => {
    expect(
      normalizePullFileEntry(
        {
          filename: "docs/runbooks/renamed-wrangler-note.md",
          status: "modified",
          previous_filename: "wrangler.jsonc",
        },
        0,
      ),
    ).toEqual({
      filename: "docs/runbooks/renamed-wrangler-note.md",
      status: "modified",
    });
    expect(
      normalizePullFileEntry(
        {
          filename: "docs/runbooks/new-note.md",
          status: "added",
          previous_filename: "wrangler.jsonc",
        },
        0,
      ),
    ).toEqual({ filename: "docs/runbooks/new-note.md", status: "added" });
  });

  it("parsePullRequestFilesApiStdout drops spoofed previous_filename for non-renamed status", () => {
    expect(
      parsePullRequestFilesApiStdout(
        readFixture("spoof-modified-with-privileged-previous-filename.json"),
      ),
    ).toEqual([
      {
        filename: "docs/runbooks/renamed-wrangler-note.md",
        status: "modified",
      },
    ]);
    expect(
      parsePullRequestFilesApiStdout(
        readFixture("spoof-added-with-privileged-previous-filename.json"),
      ),
    ).toEqual([{ filename: "docs/runbooks/new-note.md", status: "added" }]);
  });

  it("does not flag spoofed previous_filename on modified pull file entries", () => {
    const changed = parsePullRequestFilesApiStdout(
      readFixture("spoof-modified-with-privileged-previous-filename.json"),
    );
    const analysis = analyzePrivilegedChange(changed, {}, { trustedOrg: "didi-build" });
    expect(analysis.flagged).toBe(false);
    expect(analysis.privilegedFiles).toEqual([]);
    expect(analysis.findings).toEqual([]);
  });

  it("pathsConsideredForPrivilegedGate ignores previous_filename unless status is renamed", () => {
    const parsed = parsePullRequestFilesApiStdout(
      readFixture("spoof-modified-with-privileged-previous-filename.json"),
    )[0];
    expect(pathsConsideredForPrivilegedGate(parsed)).toEqual([
      "docs/runbooks/renamed-wrangler-note.md",
    ]);
    expect(privilegedFilenamesFromChangedFiles([parsed], isPrivilegedPath)).toEqual([]);
  });

  it("privilegedFilenamesFromChangedFiles sorts and de-duplicates privileged paths", () => {
    const changed = parsePullRequestFilesApiStdout(
      readFixture("rename-privileged-to-unlisted.json"),
    );
    const withDuplicate = [
      ...changed,
      { filename: "wrangler.jsonc", status: "modified" as const },
      {
        filename: ".github/workflows/extra.yml",
        status: "renamed" as const,
        previous_filename: "wrangler.jsonc",
      },
    ];
    expect(
      privilegedFilenamesFromChangedFiles(withDuplicate, isPrivilegedPath),
    ).toEqual([".github/workflows/extra.yml", "wrangler.jsonc"]);
  });

  it("pathsConsideredForPrivilegedGate uses only the new path when previous_filename is empty", () => {
    const parsed = normalizePullFileEntry(
      {
        filename: "docs/runbooks/renamed-wrangler-note.md",
        status: "renamed",
        previous_filename: "",
      },
      0,
    );
    expect(pathsConsideredForPrivilegedGate(parsed)).toEqual([
      "docs/runbooks/renamed-wrangler-note.md",
    ]);
  });

  it("pathsConsideredForPrivilegedGate lists both paths for renames with previous_filename", () => {
    expect(
      pathsConsideredForPrivilegedGate({
        filename: "docs/runbooks/renamed-wrangler-note.md",
        status: "renamed",
        previous_filename: "wrangler.jsonc",
      }),
    ).toEqual(["docs/runbooks/renamed-wrangler-note.md", "wrangler.jsonc"]);
  });
});
