import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseJsonc } from "../scripts/lib/parse-jsonc.mjs";
import {
  collectGalleryConfigViolations,
  collectGalleryDeployViolations,
  collectGalleryPreviewArgvViolations,
  collectGalleryWorkflowViolations,
  extractWranglerDeploySegments,
  flattenYamlRunBlocks,
  joinShellContinuations,
  normalizeForDeployScan,
  runGalleryGuards,
} from "../scripts/lib/check-gallery-guards-lib.mjs";

const BASE_CONFIG = {
  $schema: "node_modules/wrangler/config-schema.json",
  name: "we-met",
  workers_dev: false,
  preview_urls: true,
  compatibility_date: "2026-09-24",
  assets: {
    directory: "./dist",
    not_found_handling: "single-page-application",
  },
  observability: { enabled: true },
  previews: {},
};

const VALID_PREVIEW_ARGS = `--config wrangler.gallery.jsonc --worker-name we-met --ignore-base-config --name "gallery-pr-1" --json`;

const VALID_WORKFLOW_SNIPPET = `
run: |
  output="$(npx wrangler preview \\
    --config wrangler.gallery.jsonc \\
    --worker-name we-met \\
    --ignore-base-config \\
    --name "gallery-pr-\${PR_NUMBER}" \\
    --json 2>&1)"
`;

describe("gallery guards (unit)", () => {
  it("accepts the committed preview-only gallery config shape", () => {
    const committed = parseJsonc(readFileSync("wrangler.gallery.jsonc", "utf8"));
    expect(collectGalleryConfigViolations(committed)).toEqual([]);
    expect(collectGalleryConfigViolations(BASE_CONFIG)).toEqual([]);
  });

  it("rejects unknown top-level keys and assets.binding", () => {
    expect(
      collectGalleryConfigViolations({
        ...BASE_CONFIG,
        main: ".open-next/worker.js",
      }),
    ).toContain("wrangler.gallery.jsonc must not define top-level key main.");
    expect(
      collectGalleryConfigViolations({
        ...BASE_CONFIG,
        assets: {
          directory: "./dist",
          not_found_handling: "single-page-application",
          binding: "ASSETS",
        },
      }),
    ).toContain("wrangler.gallery.jsonc assets must not define binding.");
  });

  it("requires workers_dev false and assets.directory ./dist", () => {
    expect(
      collectGalleryConfigViolations({ ...BASE_CONFIG, workers_dev: true }),
    ).toContain("wrangler.gallery.jsonc must set workers_dev to false.");
    expect(
      collectGalleryConfigViolations({
        ...BASE_CONFIG,
        assets: {
          directory: "./dist/gallery",
          not_found_handling: "single-page-application",
        },
      }),
    ).toContain('wrangler.gallery.jsonc assets.directory must be "./dist".');
  });

  it("parses wrangler preview across shell line continuations", () => {
    expect(collectGalleryWorkflowViolations(VALID_WORKFLOW_SNIPPET)).toEqual([]);
  });

  it("rejects wrangler preview missing --ignore-base-config", () => {
    const bad = `
      npx wrangler preview --config wrangler.gallery.jsonc --worker-name we-met --name x --json
    `;
    expect(collectGalleryWorkflowViolations(bad)).toContain(
      "gallery-preview.yml wrangler preview must pass --ignore-base-config.",
    );
  });

  it("rejects wrangler preview with --var and -c", () => {
    expect(
      collectGalleryPreviewArgvViolations(`${VALID_PREVIEW_ARGS} --var FOO:bar`),
    ).toContain("gallery-preview.yml wrangler preview must not pass --var.");
    expect(
      collectGalleryPreviewArgvViolations(
        `-c wrangler.gallery.jsonc --worker-name we-met --ignore-base-config --name x --json`,
      ),
    ).toContain("gallery-preview.yml wrangler preview must not pass -c.");
  });

  it("rejects wrangler preview with a positional script", () => {
    expect(
      collectGalleryPreviewArgvViolations(`worker.js ${VALID_PREVIEW_ARGS}`),
    ).toContain(
      "gallery-preview.yml wrangler preview must not pass a positional Worker script.",
    );
  });

  it("rejects wrangler deploy in gallery-preview.yml", () => {
    expect(
      collectGalleryDeployViolations(
        "npx wrangler deploy --config wrangler.jsonc",
        ".github/workflows/gallery-preview.yml",
        { isGalleryWorkflow: true, isYaml: true },
      ),
    ).toContain(
      ".github/workflows/gallery-preview.yml must not run wrangler deploy or wrangler versions deploy.",
    );
  });

  it("detects wrangler deploy after a backslash continuation", () => {
    const script = "npx wrangler \\\n  deploy --config wrangler.gallery.jsonc";
    expect(joinShellContinuations(script)).toMatch(/\bwrangler\s+deploy\b/);
    expect(collectGalleryDeployViolations(script, "scripts/evil.mjs")).toContain(
      "scripts/evil.mjs must not run wrangler deploy/versions deploy with wrangler.gallery.jsonc.",
    );
  });

  it("detects flags before deploy subcommand", () => {
    const cmd = "wrangler --config wrangler.gallery.jsonc deploy";
    const normalized = normalizeForDeployScan(cmd);
    expect(extractWranglerDeploySegments(normalized)).toHaveLength(1);
    expect(collectGalleryDeployViolations(cmd, "scripts/evil.mjs")).toContain(
      "scripts/evil.mjs must not run wrangler deploy/versions deploy with wrangler.gallery.jsonc.",
    );
  });

  it("detects wrangler versions deploy with gallery config", () => {
    expect(
      collectGalleryDeployViolations(
        "wrangler versions deploy --config wrangler.gallery.jsonc",
        "scripts/evil.mjs",
      ),
    ).toContain(
      "scripts/evil.mjs must not run wrangler deploy/versions deploy with wrangler.gallery.jsonc.",
    );
  });

  it("flattens yaml run blocks for deploy scan", () => {
    const yaml = `
steps:
  - run: |
      npx wrangler \\
        --config wrangler.gallery.jsonc \\
        deploy
`;
    const flat = flattenYamlRunBlocks(yaml);
    expect(
      collectGalleryDeployViolations(flat, "evil.yml", { isYaml: true }),
    ).toContain(
      "evil.yml must not run wrangler deploy/versions deploy with wrangler.gallery.jsonc.",
    );
  });

  it("scans .ts files for gallery config deploy", () => {
    expect(
      collectGalleryDeployViolations(
        "await exec('wrangler deploy --config wrangler.gallery.jsonc')",
        "scripts/publish-gallery.ts",
      ),
    ).toContain(
      "scripts/publish-gallery.ts must not run wrangler deploy/versions deploy with wrangler.gallery.jsonc.",
    );
  });

  it("fails package.json gallery:deploy script fixture", () => {
    expect(
      collectGalleryDeployViolations(
        "wrangler deploy --config wrangler.gallery.jsonc",
        "package.json scripts.gallery:deploy",
      ),
    ).toContain(
      "package.json scripts.gallery:deploy must not run wrangler deploy/versions deploy with wrangler.gallery.jsonc.",
    );
  });

  it("accepts the committed gallery-preview workflow and runGalleryGuards", () => {
    const workflow = readFileSync(".github/workflows/gallery-preview.yml", "utf8");
    expect(collectGalleryWorkflowViolations(workflow)).toEqual([]);
    expect(
      collectGalleryDeployViolations(
        workflow,
        ".github/workflows/gallery-preview.yml",
        {
          isGalleryWorkflow: true,
          isYaml: true,
        },
      ),
    ).toEqual([]);
    expect(runGalleryGuards()).toEqual([]);
  });
});
