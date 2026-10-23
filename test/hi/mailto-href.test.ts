import { describe, expect, it } from "vitest";
import { mailtoHref } from "@/lib/hi-card/mailto-href";

describe("mailtoHref (unit)", () => {
  it("encodes local and domain around a literal @", () => {
    expect(mailtoHref("owner-secret@example.com")).toBe(
      "mailto:owner-secret@example.com",
    );
    expect(mailtoHref("weird+tag@sub.example.com")).toBe(
      "mailto:weird%2Btag@sub.example.com",
    );
  });

  it("returns null for empty or unsafe addresses", () => {
    expect(mailtoHref("")).toBeNull();
    expect(mailtoHref("   ")).toBeNull();
    expect(mailtoHref("no-at-sign")).toBeNull();
    expect(mailtoHref("bad?query@example.com")).toBeNull();
    expect(mailtoHref("space @example.com")).toBeNull();
  });
});
