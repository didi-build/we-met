import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildVisitorFollowUpEmail,
  formatVisitorFollowUpSubject,
} from "@/email/format-visitor-follow-up";
import type { CardEmailSnapshot } from "@/exchange/types";
import { encodeEmailSubject, sanitizeEmailHeaderValue } from "@/email/mime-headers";

const baseUrl = "https://we-met.link";

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
  pageCopy: { emailFromName: "Demo at Example" },
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
  it("uses fixed subject with visitor first name", () => {
    const subject = formatVisitorFollowUpSubject("Alex O'Neill");
    expect(subject).toBe("Great meeting you, Alex");
    const content = buildVisitorFollowUpEmail({
      card,
      visitorName: "Alex O'Neill",
      baseUrl,
    });
    expect(content.textPlain).toContain("Hi Alex,");
    expect(content.textHtml).toContain("Hi Alex,");
  });

  it("links only to the card page and We Met site", () => {
    const content = buildVisitorFollowUpEmail({
      card,
      visitorName: "Alex",
      baseUrl,
    });
    expect(content.textPlain).toContain("https://we-met.link/hi/demo");
    expect(content.textPlain).toContain("https://we-met.link");
    expect(content.textPlain).not.toMatch(/book/i);
    expect(content.textHtml).toContain('href="https://we-met.link/hi/demo"');
    expect(content.textHtml).toContain('href="https://we-met.link"');
    expect(content.textHtml).not.toContain("example.com/book");
  });

  it("includes owner role and omits photo block when photoKey is null", () => {
    const content = buildVisitorFollowUpEmail({
      card,
      visitorName: "Alex",
      baseUrl,
    });
    expect(content.textHtml).toContain("Role at Co");
    expect(content.textHtml).not.toContain("owner_photo_url");
    expect(content.textHtml).not.toMatch(/<img[^>]+48px/);
  });

  it("includes owner photo when photoKey is set", () => {
    const withPhoto: CardEmailSnapshot = { ...card, photoKey: "photos/demo.jpg" };
    const content = buildVisitorFollowUpEmail({
      card: withPhoto,
      visitorName: "Alex",
      baseUrl,
    });
    expect(content.textHtml).toContain("https://we-met.link/hi/demo/photo.jpg");
  });

  it("includes non-prod test line and subject prefix", () => {
    const subject = formatVisitorFollowUpSubject("Alex", "visitor@example.com");
    expect(subject).toContain("visitor@example.com");
    const content = buildVisitorFollowUpEmail({
      card,
      visitorName: "Alex",
      baseUrl,
      nonProdVisitorEmailLabel: "visitor@example.com",
    });
    expect(content.textPlain).toContain(
      "Test delivery (sink destination): visitor@example.com",
    );
    expect(content.subject).toContain("visitor@example.com");
  });

  it("sanitizes header injection in subject first name", () => {
    const subject = formatVisitorFollowUpSubject(
      "evil\r\nBcc: attacker@evil.com",
      undefined,
    );
    expect(subject).not.toContain("\r");
    expect(subject).not.toContain("\n");
    expect(sanitizeEmailHeaderValue(subject)).toBe(subject);
  });

  it("encodes non-ASCII subjects when wrapped for MIME", () => {
    const subject = formatVisitorFollowUpSubject("José", undefined);
    const encoded = encodeEmailSubject(subject);
    expect(encoded).toMatch(/^=\?UTF-8\?B\?/);
  });

  it("escapes dynamic HTML values", () => {
    const unsafe: CardEmailSnapshot = {
      ...card,
      contact: {
        ...card.contact,
        name: { ...card.contact.name, full: `<Ada> "Lovelace"` },
        title: `CTO & Co-founder`,
      },
    };
    const content = buildVisitorFollowUpEmail({
      card: unsafe,
      visitorName: `<script>`,
      baseUrl,
    });
    expect(content.textHtml).toContain("&lt;Ada&gt;");
    expect(content.textHtml).toContain("&amp;");
    expect(content.textHtml).toContain("&quot;Lovelace&quot;");
    expect(content.textPlain).toContain("<Ada>");
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
