import { describe, expect, it } from "vitest";
import {
  buildOwnerLeadAppendEmail,
  buildOwnerLeadRecordEmail,
} from "@/email/format-owner-lead-email";
import { buildVisitorFollowUpEmail } from "@/email/format-visitor-follow-up";
import type { CardEmailSnapshot } from "@/exchange/types";
import {
  ownerDetailsUpdateHtml,
  ownerNewLeadHtml,
  visitorFollowupHtml,
} from "@/email/templates/generated";

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
    phone: "+1",
    vcardNote: "note",
    urls: [],
  },
  pageCopy: { emailFromName: "Demo at Example" },
};

const INVISIBLE_PREHEADER_PATTERN =
  /display:none;max-height:0;overflow:hidden;mso-hide:all/;

describe("email template layout (rendered output)", () => {
  describe("invisible preheader removed from HTML sources", () => {
    it("visitor follow-up HTML has no hidden preheader block", () => {
      expect(visitorFollowupHtml).not.toMatch(INVISIBLE_PREHEADER_PATTERN);
      expect(visitorFollowupHtml).not.toContain(String.fromCodePoint(8199));
    });

    it("owner new-lead HTML has no hidden preheader block", () => {
      expect(ownerNewLeadHtml).not.toMatch(INVISIBLE_PREHEADER_PATTERN);
      expect(ownerNewLeadHtml).not.toContain(String.fromCodePoint(8199));
    });

    it("owner details-update HTML has no hidden preheader block", () => {
      expect(ownerDetailsUpdateHtml).not.toMatch(INVISIBLE_PREHEADER_PATTERN);
      expect(ownerDetailsUpdateHtml).not.toContain(String.fromCodePoint(8199));
    });
  });

  describe("visitor follow-up promo banner at bottom", () => {
    it("orders HTML: greeting card, footnote, then promo banner", () => {
      const { textHtml } = buildVisitorFollowUpEmail({
        card,
        visitorName: "Alex",
        baseUrl,
      });
      const greetingPos = textHtml.indexOf("Hi Alex,");
      const footnotePos = textHtml.indexOf("exchanged contact info at");
      const promoPos = textHtml.indexOf('class="wm-promo"');
      const sentLinePos = textHtml.indexOf("Sent with We Met</td>");
      expect(greetingPos).toBeGreaterThan(-1);
      expect(footnotePos).toBeGreaterThan(greetingPos);
      expect(promoPos).toBeGreaterThan(footnotePos);
      expect(sentLinePos).toBeGreaterThan(promoPos);
    });

    it("plain text starts with greeting and places promo after footnote", () => {
      const { textPlain } = buildVisitorFollowUpEmail({
        card,
        visitorName: "Alex",
        baseUrl,
      });
      expect(textPlain.trimStart().startsWith("Hi Alex,")).toBe(true);
      expect(textPlain.split("\n")[0]).toBe("Hi Alex,");
      expect(textPlain).not.toContain("\n---\n");
      const footnotePos = textPlain.indexOf("exchanged contact info at");
      const promoPos = textPlain.indexOf(
        "Get your own card for free: https://we-met.link",
      );
      const closingPos = textPlain.indexOf("Sent with We Met.");
      expect(promoPos).toBeGreaterThan(footnotePos);
      expect(closingPos).toBeGreaterThan(promoPos);
    });

    it("drops duplicate Get your own card link from the closing HTML line", () => {
      const { textHtml } = buildVisitorFollowUpEmail({
        card,
        visitorName: "Alex",
        baseUrl,
      });
      expect(textHtml).toContain("Sent with We Met</td>");
      expect(textHtml).not.toContain("Get your own card</a>");
    });
  });

  describe("owner emails unchanged layout (no promo banner)", () => {
    it("record email HTML has no promo banner", () => {
      const content = buildOwnerLeadRecordEmail({
        name: "Sam",
        email: "sam@example.com",
        phone: null,
        sourceUrl: "https://we-met.link/hi/demo",
        receivedAtIso: "2026-10-10T12:00:00.000Z",
      });
      expect(content.textHtml).not.toContain("wm-promo");
    });

    it("append email HTML has no promo banner", () => {
      const content = buildOwnerLeadAppendEmail({
        name: "Sam",
        email: "sam@example.com",
        jobTitle: "Founder",
        company: null,
        note: null,
      });
      expect(content.textHtml).not.toContain("wm-promo");
    });
  });
});
