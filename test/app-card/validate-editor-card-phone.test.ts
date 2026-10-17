import {
  phoneValidationMessage,
  validateEditorCardForDraft,
} from "@/app-card/validate-editor-card";
import { emptyEditorCard } from "@/app-card/route-auth";
import { describe, expect, it } from "vitest";

describe("phoneValidationMessage (unit)", () => {
  it("rejects a phone containing a newline", () => {
    expect(phoneValidationMessage("555-1234\n5678")).toBe("Use a valid phone number.");
  });

  it("allows empty phone", () => {
    expect(phoneValidationMessage("")).toBeNull();
    expect(phoneValidationMessage("   ")).toBeNull();
  });
});

describe("validateEditorCardForDraft phone (unit)", () => {
  it("returns invalid-fields when phone has a newline", () => {
    const card = { ...emptyEditorCard(), phone: "5551234\n" };
    const result = validateEditorCardForDraft(card);
    expect(result).toEqual({
      ok: false,
      code: "invalid-fields",
      fields: { phone: "Use a valid phone number." },
    });
  });
});
