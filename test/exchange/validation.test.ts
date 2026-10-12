import { describe, expect, it } from "vitest";
import { EXCHANGE_LIMITS } from "@/exchange/limits";
import {
  hasForbiddenNoteControlChars,
  hasForbiddenSingleLineControlChars,
  parseDetailsBody,
  parseExchangeBody,
} from "@/exchange/validation";

const validExchange = {
  slug: "demo",
  name: "Ada",
  email: "ada@example.com",
  turnstileToken: "tok",
};

describe("exchange validation (unit)", () => {
  it("accepts a minimal valid exchange body", () => {
    const parsed = parseExchangeBody(validExchange);
    expect(parsed.ok).toBe(true);
    expect("honeypot" in parsed).toBe(false);
  });

  it("rejects invalid email", () => {
    const parsed = parseExchangeBody({
      ...validExchange,
      email: "not-an-email",
    });
    expect(parsed.ok).toBe(false);
  });

  describe("email hardening", () => {
    it("accepts a normal address with dot and plus", () => {
      const parsed = parseExchangeBody({
        ...validExchange,
        email: "a.b+tag@example.co",
      });
      expect(parsed.ok).toBe(true);
      if (parsed.ok && !("honeypot" in parsed)) {
        expect(parsed.value.email).toBe("a.b+tag@example.co");
      }
    });

    it.each([
      ["NUL", "a\u0000b@example.com"],
      ["BEL", "a\u0007b@example.com"],
      ["DEL", "a\u007fb@example.com"],
      ["comma", "junk,victim@example.com"],
      ["semicolon", "a;b@example.com"],
      ["less-than", "a<b@example.com"],
      ["greater-than", "a>b@example.com"],
      ["quote", 'a"b@example.com'],
      ["backslash", "a\\b@example.com"],
    ])("rejects %s in email", (_label, email) => {
      expect(parseExchangeBody({ ...validExchange, email }).ok).toBe(false);
    });
  });

  it("rejects oversize name", () => {
    const parsed = parseExchangeBody({
      ...validExchange,
      name: "x".repeat(EXCHANGE_LIMITS.name + 1),
    });
    expect(parsed.ok).toBe(false);
  });

  it("accepts a formatted phone string within the server limit", () => {
    const phone = `+1 ${"5".repeat(EXCHANGE_LIMITS.phone - 3)}`;
    expect(phone.length).toBe(EXCHANGE_LIMITS.phone);
    const parsed = parseExchangeBody({
      ...validExchange,
      phone,
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok && !("honeypot" in parsed)) {
      expect(parsed.value.phone).toBe(phone);
    }
  });

  it("rejects a formatted phone string over the server limit", () => {
    const parsed = parseExchangeBody({
      ...validExchange,
      phone: `+1 ${"5".repeat(EXCHANGE_LIMITS.phone - 2)}`,
    });
    expect(parsed.ok).toBe(false);
  });

  describe("website honeypot", () => {
    it("treats absent website as human", () => {
      const parsed = parseExchangeBody(validExchange);
      expect(parsed.ok).toBe(true);
      expect("honeypot" in parsed).toBe(false);
    });

    it("treats whitespace-only website as human", () => {
      const parsed = parseExchangeBody({ ...validExchange, website: "   " });
      expect(parsed.ok).toBe(true);
      expect("honeypot" in parsed).toBe(false);
    });

    it("treats oversize website as honeypot", () => {
      const parsed = parseExchangeBody({
        ...validExchange,
        website: "x".repeat(501),
      });
      expect(parsed.ok).toBe(true);
      expect("honeypot" in parsed).toBe(true);
    });

    it("treats numeric website as honeypot", () => {
      const parsed = parseExchangeBody({ ...validExchange, website: 1 });
      expect(parsed.ok).toBe(true);
      expect("honeypot" in parsed).toBe(true);
    });

    it("treats object website as honeypot", () => {
      const parsed = parseExchangeBody({ ...validExchange, website: { x: 1 } });
      expect(parsed.ok).toBe(true);
      expect("honeypot" in parsed).toBe(true);
    });
  });

  describe("control characters", () => {
    it("rejects CR/LF in name", () => {
      const parsed = parseExchangeBody({
        ...validExchange,
        name: "A\r\nBcc: evil@example.com",
      });
      expect(parsed.ok).toBe(false);
    });

    it("rejects control chars in slug", () => {
      const parsed = parseExchangeBody({
        ...validExchange,
        slug: "dem\u0000o",
      });
      expect(parsed.ok).toBe(false);
    });

    it("rejects control chars in phone", () => {
      const parsed = parseExchangeBody({
        ...validExchange,
        phone: "+1\u007f555",
      });
      expect(parsed.ok).toBe(false);
    });

    it("rejects control chars in details jobTitle and company", () => {
      expect(
        parseDetailsBody({
          token: "t",
          jobTitle: "Eng\u2028ineer",
          company: null,
          note: null,
        }).ok,
      ).toBe(false);
      expect(
        parseDetailsBody({
          token: "t",
          jobTitle: null,
          company: "Co\u0085",
          note: null,
        }).ok,
      ).toBe(false);
    });

    it("allows tab and newline in note but rejects other controls", () => {
      expect(
        parseDetailsBody({
          token: "t",
          jobTitle: null,
          company: null,
          note: "line1\nline2\tok",
        }).ok,
      ).toBe(true);
      expect(
        parseDetailsBody({
          token: "t",
          jobTitle: null,
          company: null,
          note: "bad\u2029line",
        }).ok,
      ).toBe(false);
    });

    it("exports helpers for single-line vs note rules", () => {
      expect(hasForbiddenSingleLineControlChars("a\nb")).toBe(true);
      expect(hasForbiddenNoteControlChars("a\nb")).toBe(false);
      expect(hasForbiddenNoteControlChars("a\u2028b")).toBe(true);
    });
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
