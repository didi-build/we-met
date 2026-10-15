import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildVisitorFollowUpEmail,
  formatVisitorFollowUpSubject,
} from "@/email/format-visitor-follow-up";
import type { CardEmailSnapshot } from "@/exchange/types";
import { encodeEmailSubject, sanitizeEmailHeaderValue } from "@/email/mime-headers";

const card: CardEmailSnapshot = {
  slug: "demo",
  displayName: "Demo",
  email: "owner@example.com",
  photoKey: null,
  contact: {
    name: { full: "Demo User", family: "User", given: "Demo", nickname: "Demo" },
    org: "Co",
    title: "Role",
    email: "owner@example.com",
    phone: "+1",
    vcardNote: "note",
    urls: [],
  },
  links: { bookingUrl: "https://example.com/book" },
  pageCopy: { emailFromName: "Demo at Example" },
  copy: {
    followUpEmail: {
      subjectTemplate: "Nice meeting you, {firstName}",
      greetingTemplate: "Hi {firstName},",
      bodyParagraphs: ["Line one.", "Line two."],
      attachmentLine: "VCard attached",
      bookCtaLabel: "Book time",
      closingLine: "Cheers",
    },
  },
};

function collectTsSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTsSourceFiles(path, out);
    } else if (entry.name.endsWith(".ts")) {
      out.push(path);
    }
  }
  return out;
}

describe("format visitor follow-up email (unit)", () => {
  it("substitutes escaped first name only placeholder", () => {
    const content = buildVisitorFollowUpEmail({
      card,
      visitorName: "Alex O'Neill",
    });
    expect(content.textPlain).toContain("Hi Alex,");
    expect(content.textPlain).not.toContain("{firstName}");
    expect(content.textHtml).toContain("Hi Alex,");
  });

  it("uses booking URL from card links", () => {
    const content = buildVisitorFollowUpEmail({
      card,
      visitorName: "Alex",
    });
    expect(content.textPlain).toContain("https://example.com/book");
    expect(content.textHtml).toContain("https://example.com/book");
  });

  it("includes non-prod visitor label in body and subject prefix", () => {
    const subject = formatVisitorFollowUpSubject(card, "Alex", "visitor@example.com");
    expect(subject).toContain("visitor@example.com");
    const content = buildVisitorFollowUpEmail({
      card,
      visitorName: "Alex",
      nonProdVisitorEmailLabel: "visitor@example.com",
    });
    expect(content.textPlain).toContain("visitor@example.com");
    expect(content.subject).toContain("visitor@example.com");
  });

  it("sanitizes header injection in subject first name", () => {
    const subject = formatVisitorFollowUpSubject(
      card,
      "evil\r\nBcc: attacker@evil.com",
      undefined,
    );
    expect(subject).not.toContain("\r");
    expect(subject).not.toContain("\n");
    expect(sanitizeEmailHeaderValue(subject)).toBe(subject);
  });

  it("encodes non-ASCII subjects when wrapped for MIME", () => {
    const subject = formatVisitorFollowUpSubject(
      {
        ...card,
        copy: {
          followUpEmail: {
            ...card.copy.followUpEmail,
            subjectTemplate: "Hola {firstName}",
          },
        },
      },
      "José",
      undefined,
    );
    const encoded = encodeEmailSubject(subject);
    expect(encoded).toMatch(/^=\?UTF-8\?B\?/);
  });

  it("does not hardcode didi.build in email or consumer sources", () => {
    const dirs = [
      join(process.cwd(), "src/email"),
      join(process.cwd(), "src/followup-email-consumer"),
      join(process.cwd(), "workers"),
    ];
    for (const dir of dirs) {
      for (const file of collectTsSourceFiles(dir)) {
        const source = readFileSync(file, "utf8");
        expect(source).not.toContain("didi.build");
      }
    }
  });
});
