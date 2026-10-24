import { describe, expect, it } from "vitest";
import {
  isPlainSingleEmailAddress,
  parseLeadSinkMessage,
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
    phone: "+1",
    vcardNote: "note",
    urls: [],
  },
  pageCopy: { emailFromName: "Demo at Example" },
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

describe("parseVisitorFollowupMessage (unit)", () => {
  it("accepts queued card snapshots that still include legacy bookingUrl and followUpEmail", () => {
    const parsed = parseVisitorFollowupMessage({
      type: "visitor_followup",
      lead: { ...baseLead, email: "visitor@example.com" },
      card: {
        ...card,
        links: { bookingUrl: "https://example.com/book", footer: [] },
        copy: {
          followUpEmail: {
            subjectTemplate: "legacy",
            greetingTemplate: "legacy",
            bodyParagraphs: ["legacy"],
            attachmentLine: "legacy",
            bookCtaLabel: "legacy",
            closingLine: "legacy",
          },
        },
      },
    });
    expect(parsed?.card.slug).toBe("demo");
    expect(parsed?.card).not.toHaveProperty("links");
  });

  it("rejects visitor_followup when lead email is not a plain single address", () => {
    const parsed = parseVisitorFollowupMessage({
      type: "visitor_followup",
      lead: { ...baseLead, email: "visitor@example.com, attacker@evil.com" },
      card,
    });
    expect(parsed).toBeNull();
  });
});

const sinkCommon = {
  sinkId: "sink-1",
  sinkKind: "email",
  sinkConfig: { to: "owner@example.com" },
  cardId: "card-1",
  cardSlug: "demo",
  sourceUrl: "https://we-met.link/hi/demo",
};

const recordLeadBase = {
  leadId: "lead-1",
  submittedAt: "2026-10-12T00:00:00.000Z",
  environment: "preview",
  isTestLead: true,
  name: "Alex Visitor",
  email: "visitor@example.com",
};

describe("parseLeadSinkMessage (unit)", () => {
  it("accepts legacy lead_sink_record with a string lead.phone", () => {
    const parsed = parseLeadSinkMessage({
      type: "lead_sink_record",
      ...sinkCommon,
      lead: { ...recordLeadBase, phone: "+1 555 0100" },
    });
    expect(parsed?.type).toBe("lead_sink_record");
    if (parsed?.type === "lead_sink_record") {
      expect(parsed.lead.phone).toBe("+1 555 0100");
    }
  });

  it("accepts new lead_sink_record with lead.phone null", () => {
    const parsed = parseLeadSinkMessage({
      type: "lead_sink_record",
      ...sinkCommon,
      lead: { ...recordLeadBase, phone: null },
    });
    expect(parsed?.type).toBe("lead_sink_record");
    if (parsed?.type === "lead_sink_record") {
      expect(parsed.lead.phone).toBeNull();
    }
  });

  it("parses legacy lead_sink_append_details without details.phone as phone null", () => {
    const parsed = parseLeadSinkMessage({
      type: "lead_sink_append_details",
      ...sinkCommon,
      lead: {
        leadId: recordLeadBase.leadId,
        name: recordLeadBase.name,
        email: recordLeadBase.email,
      },
      details: { jobTitle: null, company: null, note: null },
      detailsSubmittedAt: "2026-10-12T01:00:00.000Z",
    });
    expect(parsed?.type).toBe("lead_sink_append_details");
    if (parsed?.type === "lead_sink_append_details") {
      expect(parsed.details.phone).toBeNull();
    }
  });

  it("keeps a string phone on new lead_sink_append_details", () => {
    const parsed = parseLeadSinkMessage({
      type: "lead_sink_append_details",
      ...sinkCommon,
      lead: {
        leadId: recordLeadBase.leadId,
        name: recordLeadBase.name,
        email: recordLeadBase.email,
      },
      details: {
        phone: "+1 555 0101",
        jobTitle: null,
        company: null,
        note: null,
      },
      detailsSubmittedAt: "2026-10-12T01:00:00.000Z",
    });
    expect(parsed?.type).toBe("lead_sink_append_details");
    if (parsed?.type === "lead_sink_append_details") {
      expect(parsed.details.phone).toBe("+1 555 0101");
    }
  });

  it("rejects lead_sink_append_details when details.phone is non-string and non-null", () => {
    const parsed = parseLeadSinkMessage({
      type: "lead_sink_append_details",
      ...sinkCommon,
      lead: {
        leadId: recordLeadBase.leadId,
        name: recordLeadBase.name,
        email: recordLeadBase.email,
      },
      details: {
        phone: 5550101,
        jobTitle: null,
        company: null,
        note: null,
      },
      detailsSubmittedAt: "2026-10-12T01:00:00.000Z",
    });
    expect(parsed).toBeNull();
  });
});
