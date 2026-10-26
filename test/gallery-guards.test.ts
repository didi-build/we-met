import { describe, expect, it } from "vitest";
import {
  collectGalleryConfigViolations,
  collectGalleryDeployViolations,
  collectGalleryWorkflowViolations,
} from "../scripts/lib/check-gallery-guards-lib.mjs";

const BASE_CONFIG = {
  name: "we-met",
  workers_dev: false,
  preview_urls: true,
  compatibility_date: "2026-09-24",
  assets: {
    directory: "./dist/gallery",
    not_found_handling: "single-page-application",
  },
  observability: { enabled: true },
  previews: {},
};

describe("gallery guards (unit)", () => {
  it("accepts the committed preview-only gallery config shape", () => {
    expect(collectGalleryConfigViolations(BASE_CONFIG)).toEqual([]);
  });

  it("rejects main entry", () => {
    expect(
      collectGalleryConfigViolations({ ...BASE_CONFIG, main: ".open-next/worker.js" }),
    ).toContain(
      "wrangler.gallery.jsonc must not set main (preview-only static assets).",
    );
  });

  it("rejects routes", () => {
    expect(
      collectGalleryConfigViolations({
        ...BASE_CONFIG,
        routes: [{ pattern: "we-met.link", custom_domain: true }],
      }),
    ).toContain("wrangler.gallery.jsonc must not define routes.");
  });

  it("rejects vars", () => {
    expect(
      collectGalleryConfigViolations({
        ...BASE_CONFIG,
        vars: { WE_MET_ENV: "preview" },
      }),
    ).toContain("wrangler.gallery.jsonc must not define vars.");
  });

  it("rejects non-empty previews", () => {
    expect(
      collectGalleryConfigViolations({
        ...BASE_CONFIG,
        previews: { vars: { WE_MET_ENV: "preview" } },
      }),
    ).toContain(
      "wrangler.gallery.jsonc previews must be empty (no nested bindings or vars).",
    );
  });

  it("rejects d1 binding", () => {
    expect(
      collectGalleryConfigViolations({
        ...BASE_CONFIG,
        d1_databases: [{ binding: "WE_MET_DB", database_name: "x", database_id: "y" }],
      }),
    ).toContain("wrangler.gallery.jsonc must not define binding d1_databases.");
  });

  it("requires worker name we-met", () => {
    expect(
      collectGalleryConfigViolations({ ...BASE_CONFIG, name: "we-met-gallery" }),
    ).toContain(
      'wrangler.gallery.jsonc name must remain "we-met" (Worker-scoped preview token).',
    );
  });

  it("requires ignore-base-config and worker-name in workflow", () => {
    const good = `
      npx wrangler preview --config wrangler.gallery.jsonc --worker-name we-met --ignore-base-config
    `;
    expect(collectGalleryWorkflowViolations(good)).toEqual([]);
    const bad = "npx wrangler preview --config wrangler.gallery.jsonc";
    expect(collectGalleryWorkflowViolations(bad).length).toBeGreaterThan(0);
  });

  it("rejects wrangler deploy with gallery config", () => {
    expect(
      collectGalleryDeployViolations(
        "npx wrangler deploy --config wrangler.gallery.jsonc",
        "bad.mjs",
      ),
    ).toContain(
      "bad.mjs must not run wrangler deploy/versions deploy with wrangler.gallery.jsonc.",
    );
  });
});
