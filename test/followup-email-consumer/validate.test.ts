import { describe, expect, it } from "vitest";
import {
  isPlainSingleEmailAddress,
  parseVisitorFollowupMessage,
} from "@/followup-email-consumer/validate";
import type { CardEmailSnapshot } from "@/exchange/types";

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
  links: { bookingUrl: "https://example.com/book", items: [] },
  pageCopy: { emailFromName: "Demo at Example" },
  copy: {
    followUpEmail: {
      subjectTemplate: "Hi",
      greetingTemplate: "Hi",
      bodyParagraphs: ["One"],
      attachmentLine: "Attached",
      bookCtaLabel: "Book",
      closingLine: "Bye",
    },
  },
};

const baseLead = {
  leadId: "lead-1",
  submittedAt: "2026-10-12T00:00:00.000Z",
  environment: "preview",
  isTestLead: true,
  name: "Alex Visitor",
  phone: null as string | null,
};

describe("isPlainSingleEmailAddress (unit)", () => {
  const valid = [
    "visitor@example.com",
    "user+tag@example.com",
    "a@mail.sub.example.co.uk",
  ];
  const invalid = [
    "visitor@example.com, attacker@evil.com",
    "a@b.com; c@d.com",
    "Name <a@b.com>",
    '"quoted"@example.com',
    "user name@example.com",
    "user@example.com\r\nBcc: evil@evil.com",
    "user@example.com\nBcc: evil@evil.com",
    "@example.com",
    "user@",
    "no-at-sign",
    "(comment)user@example.com",
  ];

  for (const email of valid) {
    it(`accepts ${email}`, () => {
      expect(isPlainSingleEmailAddress(email)).toBe(true);
    });
  }

  for (const email of invalid) {
    it(`rejects ${JSON.stringify(email)}`, () => {
      expect(isPlainSingleEmailAddress(email)).toBe(false);
    });
  }
});

describe("parseVisitorFollowupMessage lead email (unit)", () => {
  it("rejects visitor_followup when lead email is not a plain single address", () => {
    const parsed = parseVisitorFollowupMessage({
      type: "visitor_followup",
      lead: { ...baseLead, email: "visitor@example.com, attacker@evil.com" },
      card,
    });
    expect(parsed).toBeNull();
  });
});
