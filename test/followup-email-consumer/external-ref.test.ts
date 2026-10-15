import { describe, expect, it } from "vitest";
import {
  parseExternalRef,
  validateExternalRefForStorage,
} from "@/followup-email-consumer/external-ref";

describe("external_ref validation (unit)", () => {
  it("accepts flat id-only objects", () => {
    const ref = JSON.stringify({ issueId: "LIN-1", n: 2, ok: true, x: null });
    expect(validateExternalRefForStorage(ref)).toEqual({ ok: true, stored: ref });
    expect(parseExternalRef(ref)).toEqual({
      issueId: "LIN-1",
      n: 2,
      ok: true,
      x: null,
    });
  });

  it("rejects nested values and oversize strings", () => {
    expect(validateExternalRefForStorage(JSON.stringify({ a: { b: 1 } }))).toEqual({
      ok: false,
      code: "external_ref_invalid",
    });
    const huge = JSON.stringify({ id: "x".repeat(1100) });
    expect(validateExternalRefForStorage(huge)).toEqual({
      ok: false,
      code: "external_ref_invalid",
    });
  });
});
