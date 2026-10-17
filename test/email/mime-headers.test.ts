import { describe, expect, it } from "vitest";
import {
  encodeEmailSubject,
  formatEmailFromHeader,
  sanitizeEmailHeaderValue,
  sanitizeRfc5322MessageId,
} from "@/email/mime-headers";
import { FollowupEmailError } from "@/email/followup-email-error";

function decodeRfc2047DisplayName(fromHeader: string): string {
  const angle = fromHeader.lastIndexOf(" <");
  const encoded = angle >= 0 ? fromHeader.slice(0, angle) : fromHeader;
  const parts = encoded.split(" ").filter((part) => part.startsWith("=?UTF-8?B?"));
  const bytes: number[] = [];
  for (const part of parts) {
    const match = /^=\?UTF-8\?B\?(.+)\?=$/.exec(part);
    if (!match) {
      throw new Error(`invalid encoded word: ${part}`);
    }
    const binary = atob(match[1]);
    for (let i = 0; i < binary.length; i++) {
      bytes.push(binary.charCodeAt(i));
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

describe("mime headers (unit)", () => {
  it("strips control characters from header values", () => {
    expect(sanitizeEmailHeaderValue("hello\r\nworld")).toBe("hello world");
  });

  it("formats From with display name", () => {
    expect(formatEmailFromHeader("sender@example.com", "Demo Name")).toBe(
      '"Demo Name" <sender@example.com>',
    );
  });

  it("escapes quotes and backslashes in quoted display names", () => {
    expect(formatEmailFromHeader("sender@example.com", 'Demo "Nick" \\ Co')).toBe(
      '"Demo \\"Nick\\" \\\\ Co" <sender@example.com>',
    );
  });

  it("encodes non-ASCII From display names as RFC 2047 words without quotes", () => {
    const header = formatEmailFromHeader("hello@we-met.link", "Zoë via We Met");
    expect(header).toMatch(/^=\?UTF-8\?B\?/);
    expect(header).not.toMatch(/^"/);
    expect(header.endsWith("<hello@we-met.link>")).toBe(true);
    expect(decodeRfc2047DisplayName(header)).toBe("Zoë via We Met");
  });

  it("encodes non-ASCII names in other scripts without quotes", () => {
    const displayName = "田中 via We Met";
    const header = formatEmailFromHeader("hello@we-met.link", displayName);
    expect(header).toMatch(/^=\?UTF-8\?B\?/);
    expect(decodeRfc2047DisplayName(header)).toBe(displayName);
  });

  it("splits long non-ASCII display names into multiple RFC 2047 words", () => {
    const displayName = `${"あ".repeat(40)} via We Met`;
    const header = formatEmailFromHeader("hello@we-met.link", displayName);
    const encodedPart = header.replace(/ <hello@we-met\.link>$/, "");
    const wordCount = encodedPart
      .split(" ")
      .filter((part) => part.startsWith("=?UTF-8?B?")).length;
    expect(wordCount).toBeGreaterThan(1);
    for (const word of encodedPart.split(" ")) {
      expect(word.length).toBeLessThanOrEqual(75);
    }
    expect(decodeRfc2047DisplayName(header)).toBe(displayName);
  });

  it("rejects invalid RFC 5322 message ids", () => {
    expect(() => sanitizeRfc5322MessageId("bad-id")).toThrow(FollowupEmailError);
    expect(() => sanitizeRfc5322MessageId("bad-id")).toThrowError(
      expect.objectContaining({ code: "invalid_rfc5322_message_id" }),
    );
  });

  it("never places raw visitor injection into encoded subject", () => {
    const safe = sanitizeEmailHeaderValue("Nice\r\nBcc: bad@evil.com");
    const encoded = encodeEmailSubject(safe);
    expect(encoded).not.toContain("\r");
    expect(encoded).not.toContain("\n");
  });
});
