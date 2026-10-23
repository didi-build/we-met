import { describe, expect, it } from "vitest";
import {
  findNonprodResourcesNotOnMain,
  findPreviewBlockedResources,
  formatPreviewMissingResourceMessage,
  PROVISION_NONPROD_MAIN_WORKFLOW,
} from "../scripts/lib/preview-nonprod-resource-gate.mjs";

const BASE = {
  d1_databases: [{ binding: "WE_MET_DB", database_name: "we-met-db-nonprod" }],
  r2_buckets: [{ binding: "WE_MET_ASSETS", bucket_name: "we-met-assets-nonprod" }],
};

describe("preview non-prod resource gate (unit)", () => {
  it("allows PR with same non-prod names as main", () => {
    const main = { previews: BASE };
    const pr = { previews: BASE };
    expect(findPreviewBlockedResources(main, null, pr, null)).toEqual([]);
  });

  it("blocks new non-prod D1 name not on main", () => {
    const main = { previews: BASE };
    const pr = {
      previews: {
        d1_databases: [
          ...BASE.d1_databases,
          { binding: "WE_MET_EXTRA", database_name: "we-met-extra-db-nonprod" },
        ],
        r2_buckets: BASE.r2_buckets,
      },
    };
    const missing = findPreviewBlockedResources(main, null, pr, null);
    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({
      kind: "d1",
      name: "we-met-extra-db-nonprod",
    });
    const message = formatPreviewMissingResourceMessage(missing);
    expect(message).toContain("we-met-extra-db-nonprod");
    expect(message).toContain(PROVISION_NONPROD_MAIN_WORKFLOW);
    expect(message).toContain("does not provision");
  });

  it("findNonprodResourcesNotOnMain compares sets", () => {
    const missing = findNonprodResourcesNotOnMain(
      { d1: ["a"], r2: [] },
      { d1: ["a", "b"], r2: ["c"] },
    );
    expect(missing).toEqual([
      { kind: "d1", name: "b" },
      { kind: "r2", name: "c" },
    ]);
  });
});
