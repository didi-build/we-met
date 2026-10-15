import { describe, expect, it } from "vitest";
import { constantTimeEqual, sha256Base64Url } from "@/app-auth/crypto";

describe("app-auth crypto (unit)", () => {
  it("hashes deterministically", async () => {
    const hash = await sha256Base64Url("hello");
    expect(hash).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await sha256Base64Url("hello")).toBe(hash);
  });

  it("compares secrets in constant time", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("a", "aa")).toBe(false);
  });
});
