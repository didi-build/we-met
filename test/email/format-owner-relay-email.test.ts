import { describe, expect, it } from "vitest";
import {
  buildOwnerRelayEmail,
  formatOwnerRelayEmailSubject,
} from "@/email/format-owner-relay-email";
import { ownerRelayHtml, ownerRelayText } from "@/email/templates/generated";

describe("format owner relay email (unit)", () => {
  it("uses the relay subject and non-prod prefix", () => {
    expect(formatOwnerRelayEmailSubject("Sam Rivera")).toBe("You met Sam Rivera");
    expect(formatOwnerRelayEmailSubject("Sam", "owner@example.com")).toBe(
      "[we-met test → owner@example.com] You met Sam",
    );
  });

  it("renders title, Hit Reply line, and card link", () => {
    const content = buildOwnerRelayEmail({
      name: "Sam Rivera",
      email: "sam@example.com",
      phone: null,
      jobTitle: null,
      company: null,
      note: null,
      sourceUrl: "https://we-met.link/hi/demo",
    });
    expect(content.subject).toBe("You met Sam Rivera");
    expect(content.textPlain).toContain("You met Sam");
    expect(content.textPlain).toContain(
      "Hit Reply to write back. Your reply goes straight to Sam.",
    );
    expect(content.textHtml).toContain("You met Sam");
    expect(content.textHtml).toContain("https://we-met.link/hi/demo");
    expect(content.textHtml).toContain("we-met.link/hi/demo");
  });

  it("omits optional rows when empty and never uses a dash placeholder", () => {
    const content = buildOwnerRelayEmail({
      name: "Sam Rivera",
      email: "sam@example.com",
      phone: null,
      jobTitle: null,
      company: null,
      note: null,
      sourceUrl: "https://we-met.link/hi/demo",
    });
    expect(content.textPlain).not.toContain("Phone:");
    expect(content.textPlain).not.toMatch(/Phone:\s+-/);
    expect(content.textHtml).not.toContain(">Phone</td>");

    const full = buildOwnerRelayEmail({
      name: "Sam Rivera",
      email: "sam@example.com",
      phone: "+1 555 0100",
      jobTitle: "Founder",
      company: "Acme",
      note: "Great chat",
      sourceUrl: "https://we-met.link/hi/demo",
    });
    expect(full.textPlain).toContain("Phone:     +1 555 0100");
    expect(full.textPlain).toContain("Job title: Founder");
    expect(full.textPlain).toContain("Company:   Acme");
    expect(full.textPlain).toContain("Great chat");
  });

  it("escapes a hostile visitor name in HTML", () => {
    const content = buildOwnerRelayEmail({
      name: `<img onerror=alert(1)>`,
      email: "sam@example.com",
      phone: null,
      jobTitle: null,
      company: null,
      note: null,
      sourceUrl: "https://we-met.link/hi/demo",
    });
    expect(content.textHtml).toContain("&lt;img onerror=alert(1)&gt;");
    expect(content.textHtml).not.toContain("<img onerror");
  });

  it("matches approved owner-relay template sources", () => {
    const content = buildOwnerRelayEmail({
      name: "Sam Rivera",
      email: "sam@example.com",
      phone: "+1 555 0100",
      jobTitle: "Founder",
      company: "Acme",
      note: "Note",
      sourceUrl: "https://we-met.link/hi/demo",
      nonProdSinkDestinationLabel: "owner@example.com",
    });
    expect(ownerRelayHtml).toContain("Exchanged contacts");
    expect(ownerRelayText).toContain("Sent by We Met because");
    expect(content.textHtml).toContain("Exchanged contacts");
    expect(content.textPlain).toContain(
      "Test delivery (sink destination): owner@example.com",
    );
  });
});
