import { describe, expect, it } from "vitest";
import {
  encodeEmailSubject,
  formatEmailFromHeader,
  sanitizeEmailHeaderValue,
} from "@/email/mime-headers";

describe("mime headers (unit)", () => {
  it("strips control characters from header values", () => {
    expect(sanitizeEmailHeaderValue("hello\r\nworld")).toBe("hello world");
  });

  it("formats From with display name", () => {
    expect(formatEmailFromHeader("sender@example.com", "Demo Name")).toBe(
      '"Demo Name" <sender@example.com>',
    );
  });

  it("never places raw visitor injection into encoded subject", () => {
    const safe = sanitizeEmailHeaderValue("Nice\r\nBcc: bad@evil.com");
    const encoded = encodeEmailSubject(safe);
    expect(encoded).not.toContain("\r");
    expect(encoded).not.toContain("\n");
  });
});
