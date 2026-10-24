import { describe, expect, it } from "vitest";
import {
  appendTemplateData,
  buildOwnerLeadAppendEmail,
  buildOwnerLeadRecordEmail,
  formatOwnerLeadEmailSubjects,
} from "@/email/format-owner-lead-email";

describe("format owner lead email (unit)", () => {
  it("pairs record and append subjects for threading", () => {
    const subjects = formatOwnerLeadEmailSubjects("Sam");
    expect(subjects.record).toBe("New lead added: Sam");
    expect(subjects.append).toBe("Re: New lead added: Sam");
  });

  it("applies the same non-prod prefix to record and append subjects", () => {
    const subjects = formatOwnerLeadEmailSubjects("Sam", "owner@example.com");
    expect(subjects.record).toBe(
      "[we-met test → owner@example.com] New lead added: Sam",
    );
    expect(subjects.append).toBe(
      "Re: [we-met test → owner@example.com] New lead added: Sam",
    );
  });

  it("escapes visitor fields in record HTML and uses tel/mailto links", () => {
    const content = buildOwnerLeadRecordEmail({
      name: `<script>`,
      email: `a"b@c.com`,
      phone: "+1 416 555 0100",
      sourceUrl: "https://we-met.link/hi/demo",
      receivedAtIso: "2026-10-10T12:00:00.000Z",
    });
    expect(content.textHtml).toContain("&lt;script&gt;");
    expect(content.textHtml).toContain('href="mailto:a&quot;b@c.com"');
    expect(content.textHtml).toContain('href="tel:+14165550100"');
    expect(content.textPlain).toContain("Phone:     +1 416 555 0100");
    expect(content.textPlain).toContain("(America/Toronto)");
    expect(content.textHtml).toContain("format-detection");
  });

  it("shows dash when phone is absent in record email", () => {
    const content = buildOwnerLeadRecordEmail({
      name: "Sam",
      email: "sam@example.com",
      phone: null,
      sourceUrl: "https://we-met.link/hi/demo",
      receivedAtIso: "2026-10-10T12:00:00.000Z",
    });
    expect(content.textPlain).toContain("Phone:     -");
  });

  it("sets lead_phone template fields in appendTemplateData when phone is given", () => {
    const data = appendTemplateData({
      name: "Sam",
      email: "sam@example.com",
      phone: "+1 555 0103",
      jobTitle: null,
      company: null,
      note: null,
    });
    expect(data.lead_phone).toBe("+1 555 0103");
    expect(data.lead_phone_tel).toBe("+15550103");
  });

  it("leaves lead_phone template fields unset in appendTemplateData when phone is null", () => {
    const data = appendTemplateData({
      name: "Sam",
      email: "sam@example.com",
      phone: null,
      jobTitle: null,
      company: null,
      note: null,
    });
    expect(data.lead_phone).toBeUndefined();
    expect(data.lead_phone_tel).toBeUndefined();
  });

  it("includes visitor phone in owner details-update email when provided", () => {
    const content = buildOwnerLeadAppendEmail({
      name: "Sam",
      email: "sam@example.com",
      phone: "+1 555 0104",
      jobTitle: null,
      company: null,
      note: null,
    });
    expect(content.textPlain).toContain("Phone:     +1 555 0104");
    expect(content.textHtml).toContain('href="tel:+15550104"');
    expect(content.textHtml).toContain("+1 555 0104");
  });

  it("omits phone row from owner details-update email when phone is null", () => {
    const content = buildOwnerLeadAppendEmail({
      name: "Sam",
      email: "sam@example.com",
      phone: null,
      jobTitle: "Founder",
      company: null,
      note: null,
    });
    expect(content.textPlain).not.toMatch(/Phone:/);
    expect(content.textHtml).not.toContain(">Phone</td>");
  });

  it("includes only provided detail fields in append plain text", () => {
    const content = buildOwnerLeadAppendEmail({
      name: "Sam",
      email: "sam@example.com",
      phone: null,
      jobTitle: "Founder",
      company: null,
      note: null,
    });
    expect(content.textPlain).toContain("Job title: Founder");
    expect(content.textPlain).not.toContain("Company:");
    expect(content.subject).toBe("Re: New lead added: Sam");
    expect(content.textPlain).toContain("Sent by We Met because Sam added details");
  });

  it("shows test delivery line in non-prod only", () => {
    const prod = buildOwnerLeadRecordEmail({
      name: "Sam",
      email: "sam@example.com",
      phone: null,
      sourceUrl: "https://we-met.link/hi/demo",
      receivedAtIso: "2026-10-10T12:00:00.000Z",
    });
    expect(prod.textPlain).not.toContain("Test delivery");

    const nonProd = buildOwnerLeadRecordEmail({
      name: "Sam",
      email: "sam@example.com",
      phone: null,
      sourceUrl: "https://we-met.link/hi/demo",
      receivedAtIso: "2026-10-10T12:00:00.000Z",
      nonProdSinkDestinationLabel: "owner@example.com",
    });
    expect(nonProd.textPlain).toContain(
      "Test delivery (sink destination): owner@example.com",
    );
  });

  it("escapes note in append HTML", () => {
    const content = buildOwnerLeadAppendEmail({
      name: "Sam",
      email: "sam@example.com",
      phone: null,
      jobTitle: null,
      company: null,
      note: `<unsafe> & "quotes"`,
    });
    expect(content.textHtml).toContain("&lt;unsafe&gt; &amp; &quot;quotes&quot;");
    expect(content.textPlain).toContain(`<unsafe> & "quotes"`);
  });
});
