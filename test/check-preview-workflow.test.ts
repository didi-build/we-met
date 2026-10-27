import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseJsonc } from "../scripts/lib/parse-jsonc.mjs";
import { auditPreviewRepository } from "../scripts/check-preview-workflow.mjs";
import {
  REGRESSION_PRE_PR_WRANGLER_PREVIEW_LINE,
  findProductionTokenReferencesInText,
  findPullRequestWorkflowViolations,
  findProductionResourceMarkerViolations,
  findSharedResourceIdViolations,
  findWranglerInvocationViolations,
  workflowOnTriggersPullRequest,
} from "../scripts/lib/preview-workflow-guard.mjs";
import {
  collectWranglerConfigPaths,
  joinShellContinuationLines,
  validateWranglerConfigPaths,
} from "../scripts/lib/wrangler-config-path.mjs";
import { deletePreviewByName } from "../scripts/lib/wrangler-preview-delete-lib.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const cliScript = join(root, "scripts/check-preview-workflow.mjs");

const WRANGLER_PROD = `{"name":"we-met","compatibility_date":"2026-09-24","d1_databases":[{"binding":"WE_MET_DB","database_id":"00000000-0000-0000-0000-000000000001"}]}\n`;
const WRANGLER_PREVIEW = `{"name":"we-met-preview","compatibility_date":"2026-09-24","workers_dev":true,"preview_urls":true,"d1_databases":[{"binding":"WE_MET_DB","database_id":"00000000-0000-0000-0000-000000000002"}]}\n`;

function runCli(cwd: string) {
  try {
    execFileSync("node", [cliScript], { cwd, encoding: "utf8", stdio: "pipe" });
    return { status: 0, stderr: "" };
  } catch (err: unknown) {
    const e = err as { status?: number; stderr?: string };
    return { status: e.status ?? 1, stderr: e.stderr ?? "" };
  }
}

function seedRepo(dir: string) {
  writeFileSync(join(dir, "wrangler.jsonc"), WRANGLER_PROD);
  writeFileSync(join(dir, "wrangler.preview.jsonc"), WRANGLER_PREVIEW);
  mkdirSync(join(dir, ".github/workflows"), { recursive: true });
  writeFileSync(
    join(dir, ".github/workflows/preview.yml"),
    readFileSync(join(root, ".github/workflows/preview.yml"), "utf8"),
  );
  writeFileSync(
    join(dir, ".github/workflows/gallery-preview.yml"),
    readFileSync(join(root, ".github/workflows/gallery-preview.yml"), "utf8"),
  );
}

function auditMessages(dir: string) {
  return auditPreviewRepository(dir).flatMap((entry) => entry.messages);
}

describe("preview-workflow guard (unit)", () => {
  it("detects pull_request triggers from parsed on: keys only", () => {
    expect(workflowOnTriggersPullRequest({ push: { branches: ["main"] } })).toBe(false);
    expect(workflowOnTriggersPullRequest({ pull_request: {} })).toBe(true);
    expect(workflowOnTriggersPullRequest({ pull_request_review: {} })).toBe(true);
    expect(workflowOnTriggersPullRequest({ pull_request_review_comment: {} })).toBe(
      true,
    );
    expect(workflowOnTriggersPullRequest("pull_request")).toBe(true);
  });

  it("detects production token dot, bracket, legacy nonprod, and toJSON(secrets) forms", () => {
    expect(
      findProductionTokenReferencesInText("token: ${{ secrets.CLOUDFLARE_API_TOKEN }}"),
    ).not.toEqual([]);
    expect(
      findProductionTokenReferencesInText(
        "token: ${{ secrets.CLOUDFLARE_API_TOKEN_STAGING }}",
      ),
    ).not.toEqual([]);
    expect(
      findProductionTokenReferencesInText(
        "token: ${{ secrets.CLOUDFLARE_API_TOKEN_NONPROD }}",
      ),
    ).not.toEqual([]);
    expect(
      findProductionTokenReferencesInText("secrets[ 'CLOUDFLARE_API_TOKEN' ]"),
    ).not.toEqual([]);
    expect(findProductionTokenReferencesInText("toJSON(secrets)")).not.toEqual([]);
    expect(findProductionTokenReferencesInText("secrets: inherit")).not.toEqual([]);
    expect(
      findProductionTokenReferencesInText(
        "${{ secrets.CLOUDFLARE_API_TOKEN_PREVIEW }}",
      ),
    ).toEqual([]);
    expect(
      findProductionTokenReferencesInText(
        "${{ secrets.CLOUDFLARE_API_TOKEN_MIGRATE_NONPROD }}",
        "migrate-nonprod.yml",
      ),
    ).toEqual([]);
  });
});

describe("preview-workflow guard regressions (unit)", () => {
  it("flags production D1 name and rate-limit namespace ids in preview config", () => {
    const preview = parseJsonc(
      readFileSync(join(root, "wrangler.preview.jsonc"), "utf8"),
    ) as Record<string, unknown>;
    expect(
      findProductionResourceMarkerViolations(preview, "wrangler.preview.jsonc"),
    ).toEqual([]);

    const bad = { ...preview, d1_databases: [{ database_name: "we-met-db" }] };
    expect(
      findProductionResourceMarkerViolations(bad, "wrangler.preview.jsonc").some((m) =>
        m.includes("we-met-db"),
      ),
    ).toBe(true);

    const badRl = {
      ...preview,
      ratelimits: [{ name: "EXCHANGE", namespace_id: "2002" }],
    };
    expect(
      findProductionResourceMarkerViolations(badRl, "wrangler.preview.jsonc").some(
        (m) => m.includes("2002"),
      ),
    ).toBe(true);
  });
  it("blocks the exact pre-DIDI-918 wrangler preview deploy line (wrangler.ci.jsonc)", () => {
    const violations = findWranglerInvocationViolations(
      REGRESSION_PRE_PR_WRANGLER_PREVIEW_LINE,
      "we-met",
    );
    expect(violations.some((v) => v.includes("wrangler.preview"))).toBe(true);
  });

  it("blocks wrangler preview delete without WRANGLER_CONFIG in the delete helper", () => {
    const prev = process.env.WRANGLER_CONFIG;
    delete process.env.WRANGLER_CONFIG;
    expect(deletePreviewByName("pr-1", { encoding: "utf8", env: process.env })).toBe(1);
    if (prev !== undefined) {
      process.env.WRANGLER_CONFIG = prev;
    }
  });

  it("blocks wrangler preview delete when WRANGLER_CONFIG is not an allowed preview config", () => {
    const prev = process.env.WRANGLER_CONFIG;
    process.env.WRANGLER_CONFIG = "wrangler.jsonc";
    expect(deletePreviewByName("pr-1", { encoding: "utf8", env: process.env })).toBe(1);
    if (prev !== undefined) {
      process.env.WRANGLER_CONFIG = prev;
    } else {
      delete process.env.WRANGLER_CONFIG;
    }
  });

  it("blocks --worker-name we-met in pull request workflows", () => {
    const workflow = {
      on: { pull_request: {} },
      jobs: {
        preview: {
          steps: [
            {
              run: 'npx wrangler preview --config wrangler.preview.jsonc --worker-name we-met --name "pr-1"',
            },
          ],
        },
      },
      __rawText: "",
    };
    const messages = findPullRequestWorkflowViolations(
      workflow,
      "preview.yml",
      "we-met",
    );
    expect(messages.some((m) => m.includes("--worker-name"))).toBe(true);
  });

  it("blocks an extra wrangler deploy step in pull request workflows", () => {
    const workflow = {
      on: { pull_request: {} },
      jobs: {
        bad: {
          steps: [{ run: "npx wrangler deploy" }],
        },
      },
      __rawText: "",
    };
    const messages = findPullRequestWorkflowViolations(
      workflow,
      "preview.yml",
      "we-met",
    );
    expect(messages.some((m) => m.includes("forbidden wrangler deploy"))).toBe(true);
  });

  it("fails when deploy step drops preview config path", () => {
    const dir = mkdtempSync(join(tmpdir(), "preview-wf-no-config-"));
    seedRepo(dir);
    const previewPath = join(dir, ".github/workflows/preview.yml");
    let yaml = readFileSync(previewPath, "utf8");
    yaml = yaml.replace(
      `npx wrangler preview \\
            --config wrangler.preview.ci.jsonc \\
`,
      `npx wrangler preview \\
`,
    );
    writeFileSync(previewPath, yaml);
    const messages = auditMessages(dir);
    expect(messages.some((m) => m.includes("wrangler.preview"))).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails when cleanup omits WRANGLER_CONFIG for wrangler-preview-delete.mjs", () => {
    const dir = mkdtempSync(join(tmpdir(), "preview-wf-no-wrangler-config-"));
    seedRepo(dir);
    const previewPath = join(dir, ".github/workflows/preview.yml");
    let yaml = readFileSync(previewPath, "utf8");
    yaml = yaml.replace("\n          WRANGLER_CONFIG: wrangler.preview.jsonc\n", "\n");
    writeFileSync(previewPath, yaml);
    const messages = auditMessages(dir);
    expect(messages.some((m) => m.includes("WRANGLER_CONFIG"))).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("preview-workflow guard round 2 bypasses (unit)", () => {
  function prWorkflow(run: string) {
    return {
      on: { pull_request: {} },
      jobs: { preview: { steps: [{ run }] } },
      __rawText: "",
    };
  }

  it("blocks shell continuation with --worker-name on the next line", () => {
    const run = `npx wrangler preview \\
  --worker-name we-met --name "pr-1"`;
    const joined = joinShellContinuationLines(run);
    const messages = findPullRequestWorkflowViolations(
      prWorkflow(run),
      "preview.yml",
      "we-met",
    );
    expect(joined).toContain("--worker-name we-met");
    expect(messages.some((m) => m.includes("--worker-name"))).toBe(true);
  });

  it("blocks a second production config flag after the preview config", () => {
    const run =
      "npx wrangler preview --config wrangler.preview.jsonc --config=wrangler.jsonc --name pr-1";
    expect(
      validateWranglerConfigPaths(collectWranglerConfigPaths(run)).some((v) =>
        v.includes("wrangler.jsonc"),
      ),
    ).toBe(true);
    const messages = findPullRequestWorkflowViolations(
      prWorkflow(run),
      "preview.yml",
      "we-met",
    );
    expect(messages.length).toBeGreaterThan(0);
  });

  it("blocks preview D1 bindings that reuse a production database_id under another name", () => {
    const production = {
      d1_databases: [
        { binding: "DB", database_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" },
      ],
    };
    const preview = {
      d1_databases: [
        {
          binding: "PREVIEW_DB",
          database_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        },
      ],
    };
    expect(findSharedResourceIdViolations(production, preview)).not.toEqual([]);
  });
});

describe("check-preview-workflow CLI (subprocess)", () => {
  it("exits 0 for the we-met repository checkout", () => {
    expect(runCli(root).status).toBe(0);
  });
});
