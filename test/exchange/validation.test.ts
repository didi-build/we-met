import { describe, expect, it } from "vitest";
import { parseDetailsBody, parseExchangeBody } from "@/exchange/validation";

describe("exchange validation (unit)", () => {
  it("accepts a minimal valid exchange body", () => {
    const parsed = parseExchangeBody({
      slug: "demo",
      name: "Ada",
      email: "ada@example.com",
      turnstileToken: "tok",
      website: "",
    });
    expect(parsed.ok).toBe(true);
  });

  it("rejects invalid email", () => {
    const parsed = parseExchangeBody({
      slug: "demo",
      name: "Ada",
      email: "not-an-email",
      turnstileToken: "tok",
    });
    expect(parsed.ok).toBe(false);
  });

  it("rejects oversize fields", () => {
    const parsed = parseExchangeBody({
      slug: "demo",
      name: "x".repeat(201),
      email: "ada@example.com",
      turnstileToken: "tok",
    });
    expect(parsed.ok).toBe(false);
  });

  it("parses details body", () => {
    const parsed = parseDetailsBody({
      token: "abc",
      jobTitle: "Engineer",
      company: "",
      note: null,
    });
    expect(parsed.ok).toBe(true);
  });
});
