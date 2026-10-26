import { describe, expect, it } from "vitest";
import { resolveNextConfigSecurityHeaders } from "@/lib/we-met/next-config-headers";
import { NON_PRODUCTION_X_ROBOTS_TAG } from "@/lib/we-met/non-production";

describe("resolveNextConfigSecurityHeaders (unit)", () => {
  it("returns no header rules in production", () => {
    expect(resolveNextConfigSecurityHeaders("production")).toEqual([]);
  });

  it("returns a catch-all X-Robots-Tag rule on staging", () => {
    expect(resolveNextConfigSecurityHeaders("staging")).toEqual([
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: NON_PRODUCTION_X_ROBOTS_TAG }],
      },
    ]);
  });
});
