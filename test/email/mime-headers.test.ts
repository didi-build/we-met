import { describe, expect, it } from "vitest";
import {
  encodeEmailSubject,
  formatEmailFromHeader,
  sanitizeEmailHeaderValue,
  sanitizeRfc5322MessageId,
} from "@/email/mime-headers";
import { FollowupEmailError } from "@/email/followup-email-error";

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
