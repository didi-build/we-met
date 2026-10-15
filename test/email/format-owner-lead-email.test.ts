import { describe, expect, it } from "vitest";
import {
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

  it("escapes visitor fields in record HTML", () => {
    const content = buildOwnerLeadRecordEmail({
      name: `<script>`,
      email: `a"b@c.com`,
      phone: null,
      sourceUrl: "https://we-met.link/hi/demo",
      receivedAtIso: "2026-10-10T12:00:00.000Z",
    });
    expect(content.textHtml).toContain("&lt;script&gt;");
    expect(content.textHtml).toContain("mailto:a&quot;b@c.com");
    expect(content.textPlain).toContain("Phone: —");
  });

  it("includes only provided detail fields in append plain text", () => {
    const content = buildOwnerLeadAppendEmail({
      name: "Sam",
      email: "sam@example.com",
      jobTitle: "Founder",
      company: null,
      note: null,
      sourceUrl: "https://we-met.link/hi/demo",
      detailsSubmittedAtIso: "2026-10-10T12:00:00.000Z",
    });
    expect(content.textPlain).toContain("Job title:");
    expect(content.textPlain).not.toContain("Company:");
    expect(content.subject).toBe("Re: New lead added: Sam");
  });
});
