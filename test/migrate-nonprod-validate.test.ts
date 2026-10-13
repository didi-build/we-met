import { describe, expect, it } from "vitest";
import { validatePrNumber } from "../scripts/migrate-nonprod/validate.mjs";

describe("validatePrNumber (unit)", () => {
  it("accepts digits only", () => {
    expect(validatePrNumber("13")).toEqual({ ok: true, prNumber: "13" });
    expect(validatePrNumber("13a").ok).toBe(false);
  });
});
