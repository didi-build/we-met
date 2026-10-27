import { describe, expect, it } from "vitest";
import { lookupCard } from "@/card-data/lookup";
import { D1CardRepository } from "@/card-data/d1-repository";
import { buildOwnerRelayEmail } from "@/email/format-owner-relay-email";
import { processVCardDownload } from "@/exchange/process-vcard";
import { parseExchangeBody } from "@/exchange/validation";
import type { VisitorEmailMode } from "@/app-settings/defaults";
import { withIsolatedLocalD1 } from "../helpers/d1";
import {
  assertDelayedFallbacksQueuedOnExchange,
  assertOwnerRelayOmitsEmptyOptionalRows,
  assertOwnerRelayOutbound,
  assertVisitorLetterToOwner,
  assertVisitorLetterToVisitor,
  deliverAllExchangeEmails,
  deliverOwnerSinkBodyTwiceWithRetry,
  finalizeWithDetails,
  finalizeWithDismiss,
  ownerSinkDeliveryOrder,
  RELAY_E2E_CARD_SLUG,
  RELAY_E2E_DAY,
  RELAY_E2E_OWNER_EMAIL,
  setupRelayExchange,
  tryFinalizeWithDetails,
  tryFinalizeWithDismiss,
  type RelayE2EContext,
} from "../helpers/relay-exchange-e2e";

const hostConfig = {
  baseUrl: "https://we-met.link",
  previewHostSuffix: "-we-met-preview.example.workers.dev",
  weMetEnv: "production",
};

const ownerRelayModeCases: {
  label: string;
  mode: VisitorEmailMode | undefined;
}[] = [
  { label: "missing visitor_email_mode", mode: undefined },
  { label: "explicit owner_relay", mode: "owner_relay" },
];

function immediateOwnerSinkBody(ctx: RelayE2EContext): unknown {
  const ordered = ownerSinkDeliveryOrder(ctx.sinkMessages);
  const immediate = ordered.find(
    (q) => (q.message as { type?: string }).type === "lead_sink_owner_email",
  );
  if (!immediate) {
    throw new Error("expected lead_sink_owner_email queue message");
  }
  return immediate.message;
}

describe.each(ownerRelayModeCases)(
  "relay exchange path (owner_relay: $label, integration)",
  ({ mode }) => {
    it("step 1 accepts name and email only; phone is ignored on exchange", () => {
      const parsed = parseExchangeBody({
        slug: RELAY_E2E_CARD_SLUG,
        name: "Sam Visitor",
        email: "visitor@example.com",
        turnstileToken: "tok",
        phone: "+1 555 0100",
      });
      expect(parsed.ok).toBe(true);
      if (parsed.ok && !("honeypot" in parsed)) {
        expect(parsed.value).not.toHaveProperty("phone");
        expect(parsed.value.email).toBe("visitor@example.com");
      }
    });

    it("sends visitor letter and owner relay email when details are submitted", async () => {
      await withIsolatedLocalD1(async (db) => {
        const ctx = await setupRelayExchange(
          db,
          mode,
          `lead-relay-details-${mode ?? "default"}`,
        );
        await finalizeWithDetails(ctx, {
          phone: "+1 555 0102",
          jobTitle: "Engineer",
          company: "Acme",
          note: "Met at demo",
        });
        await deliverAllExchangeEmails(ctx);
        expect(ctx.visitorLetters).toHaveLength(1);
        expect(ctx.ownerEmails).toHaveLength(1);
        assertVisitorLetterToOwner(ctx.visitorLetters[0]!);
        assertOwnerRelayOutbound(ctx.ownerEmails[0]!, "Sam Visitor");
        expect(ctx.ownerEmails[0]!.textPlain).toContain("Phone:     +1 555 0102");
        expect(ctx.ownerEmails[0]!.textPlain).toContain("Job title: Engineer");
        expect(ctx.ownerEmails[0]!.textPlain).toContain("Company:   Acme");
        expect(ctx.ownerEmails[0]!.textPlain).toContain("Met at demo");
      });
    });

    it("sends visitor letter and owner relay email when details are dismissed", async () => {
      await withIsolatedLocalD1(async (db) => {
        const ctx = await setupRelayExchange(
          db,
          mode,
          `lead-relay-dismiss-${mode ?? "default"}`,
        );
        await finalizeWithDismiss(ctx);
        await deliverAllExchangeEmails(ctx);
        expect(ctx.visitorLetters).toHaveLength(1);
        expect(ctx.ownerEmails).toHaveLength(1);
        assertVisitorLetterToOwner(ctx.visitorLetters[0]!);
        assertOwnerRelayOutbound(ctx.ownerEmails[0]!, "Sam Visitor");
        assertOwnerRelayOmitsEmptyOptionalRows(ctx.ownerEmails[0]!);
      });
    });

    it("sends visitor letter and owner relay email on the 10-minute fallback only", async () => {
      await withIsolatedLocalD1(async (db) => {
        const ctx = await setupRelayExchange(
          db,
          mode,
          `lead-relay-fallback-${mode ?? "default"}`,
        );
        assertDelayedFallbacksQueuedOnExchange(ctx);
        await deliverAllExchangeEmails(ctx);
        expect(ctx.visitorLetters).toHaveLength(1);
        expect(ctx.ownerEmails).toHaveLength(1);
        assertVisitorLetterToOwner(ctx.visitorLetters[0]!);
        assertOwnerRelayOutbound(ctx.ownerEmails[0]!, "Sam Visitor");
        assertOwnerRelayOmitsEmptyOptionalRows(ctx.ownerEmails[0]!);
      });
    });

    it("does not send twice when immediate and fallback queue messages are both delivered", async () => {
      await withIsolatedLocalD1(async (db) => {
        const ctx = await setupRelayExchange(
          db,
          mode,
          `lead-relay-dedupe-${mode ?? "default"}`,
        );
        await finalizeWithDetails(ctx, {
          phone: null,
          jobTitle: null,
          company: null,
          note: null,
        });
        await deliverAllExchangeEmails(ctx);
        expect(ctx.visitorLetters).toHaveLength(1);
        expect(ctx.ownerEmails).toHaveLength(1);
        assertOwnerRelayOmitsEmptyOptionalRows(ctx.ownerEmails[0]!);
      });
    });

    it("counts owner and visitor slots in daily_send_counts", async () => {
      await withIsolatedLocalD1(async (db) => {
        const ctx = await setupRelayExchange(
          db,
          mode,
          `lead-relay-caps-${mode ?? "default"}`,
        );
        await finalizeWithDismiss(ctx);
        await deliverAllExchangeEmails(ctx);
        const owner = await db
          .prepare(
            `SELECT count FROM daily_send_counts WHERE day = ? AND card_id = ? AND kind = 'owner'`,
          )
          .bind(RELAY_E2E_DAY, ctx.card.id)
          .first<{ count: number }>();
        const visitor = await db
          .prepare(
            `SELECT count FROM daily_send_counts WHERE day = ? AND card_id = ? AND kind = 'visitor'`,
          )
          .bind(RELAY_E2E_DAY, ctx.card.id)
          .first<{ count: number }>();
        expect(owner?.count).toBe(1);
        expect(visitor?.count).toBe(1);
      });
    });

    it("returns the owner vCard from the token-gated download route", async () => {
      await withIsolatedLocalD1(async (db) => {
        const ctx = await setupRelayExchange(
          db,
          mode,
          `lead-relay-vcard-${mode ?? "default"}`,
        );
        const repo = new D1CardRepository(db);
        const result = await processVCardDownload(
          { token: ctx.detailsToken },
          { hostname: "we-met.link", hostConfig },
          repo,
          {
            tokenSecret: ctx.exchangeDeps.tokenSecret,
            rateLimiter: { check: async () => ({ allowed: true }) },
            clientIp: "203.0.113.50",
            assets: { get: async () => null },
            now: () => ctx.exchangeDeps.now(),
          },
        );
        expect(result.status).toBe("success");
        if (result.status === "success") {
          expect(result.vcardBody).toContain(
            `EMAIL;TYPE=INTERNET,WORK:${RELAY_E2E_OWNER_EMAIL}`,
          );
          expect(result.vcardBody).toContain("FN:Relay Google Name");
          expect(result.vcardBody).toContain("TEL;TYPE=CELL:+1 555 0199");
        }

        const card = await lookupCard(
          { hostname: "we-met.link", pathname: `/hi/${RELAY_E2E_CARD_SLUG}` },
          repo,
          hostConfig,
        );
        expect(card?.email).toBe(RELAY_E2E_OWNER_EMAIL);
      });
    });
  },
);

describe("relay exchange path (owner_relay: duplicate triggers, integration)", () => {
  it("delivers the same owner sink message twice (retry) and sends only once", async () => {
    await withIsolatedLocalD1(async (db) => {
      const ctx = await setupRelayExchange(db, "owner_relay", "lead-relay-retry-dup");
      await finalizeWithDetails(ctx, {
        phone: null,
        jobTitle: null,
        company: null,
        note: null,
      });
      const body = immediateOwnerSinkBody(ctx);
      await deliverOwnerSinkBodyTwiceWithRetry(ctx, body);
      expect(ctx.ownerEmails).toHaveLength(1);
    });
  });

  it("dismiss twice still yields one letter and one owner email after queue delivery", async () => {
    await withIsolatedLocalD1(async (db) => {
      const ctx = await setupRelayExchange(
        db,
        "owner_relay",
        "lead-relay-dismiss-twice",
      );
      const first = await tryFinalizeWithDismiss(ctx);
      expect(first.status).toBe("success");
      const second = await tryFinalizeWithDismiss(ctx);
      expect(second.status).toBe("already_finalized");
      await deliverAllExchangeEmails(ctx);
      expect(ctx.visitorLetters).toHaveLength(1);
      expect(ctx.ownerEmails).toHaveLength(1);
    });
  });

  it("submit details twice still yields one letter and one owner email after queue delivery", async () => {
    await withIsolatedLocalD1(async (db) => {
      const ctx = await setupRelayExchange(
        db,
        "owner_relay",
        "lead-relay-details-twice",
      );
      const details = {
        phone: "+1 555 0102",
        jobTitle: "Engineer",
        company: "Acme",
        note: "Once",
      };
      const first = await tryFinalizeWithDetails(ctx, details);
      expect(first.status).toBe("success");
      const second = await tryFinalizeWithDetails(ctx, details);
      expect(second.status).toBe("details_already_sent");
      await deliverAllExchangeEmails(ctx);
      expect(ctx.visitorLetters).toHaveLength(1);
      expect(ctx.ownerEmails).toHaveLength(1);
    });
  });
});

describe("owner relay template optional rows (unit guard)", () => {
  it("fails if empty optional fields render dash placeholders or row labels", () => {
    const content = buildOwnerRelayEmail({
      name: "Sam Visitor",
      email: "visitor@example.com",
      phone: null,
      jobTitle: null,
      company: null,
      note: null,
      sourceUrl: "https://we-met.link/hi/demo",
    });
    const asEmail = {
      to: RELAY_E2E_OWNER_EMAIL,
      replyTo: "visitor@example.com",
      subject: content.subject,
      textPlain: content.textPlain,
      textHtml: content.textHtml,
      from: "hello@mail.we-met.link",
    };
    assertOwnerRelayOmitsEmptyOptionalRows(asEmail);

    const poisoned = buildOwnerRelayEmail({
      name: "Sam Visitor",
      email: "visitor@example.com",
      phone: null,
      jobTitle: null,
      company: "-",
      note: "-",
      sourceUrl: "https://we-met.link/hi/demo",
    });
    expect(poisoned.textPlain).toContain("Company:   -");
    expect(poisoned.textPlain).toMatch(/Note:\s*\n\s*-/);
  });
});

describe("relay exchange path (direct visitor_email_mode, integration)", () => {
  it("sends visitor letter to the visitor and owner relay email with vCard", async () => {
    await withIsolatedLocalD1(async (db) => {
      const ctx = await setupRelayExchange(db, "direct");
      expect(ctx.followupMessages).toHaveLength(1);
      expect((ctx.followupMessages[0] as { type?: string }).type).toBe(
        "visitor_letter_due",
      );
      await finalizeWithDetails(ctx, {
        phone: "+1 555 0102",
        jobTitle: "Engineer",
        company: "Acme",
        note: "Note",
      });
      await deliverAllExchangeEmails(ctx);
      expect(ctx.ownerEmails).toHaveLength(1);
      assertOwnerRelayOutbound(ctx.ownerEmails[0]!, "Sam Visitor");
      expect(ctx.ownerEmails[0]!.textPlain).toContain("Job title: Engineer");
      expect(ctx.visitorLetters).toHaveLength(1);
      const letter = ctx.visitorLetters[0]!;
      assertVisitorLetterToVisitor(letter);
      const vcardBody = letter.attachments?.[0]?.body ?? "";
      expect(vcardBody).toContain("BEGIN:VCARD");
      expect(vcardBody).toContain(RELAY_E2E_OWNER_EMAIL);
    });
  });

  it("delivers only one letter and one owner email when fallback and immediate messages are processed", async () => {
    await withIsolatedLocalD1(async (db) => {
      const ctx = await setupRelayExchange(db, "direct", "lead-direct-dup");
      await finalizeWithDismiss(ctx);
      await deliverAllExchangeEmails(ctx);
      expect(ctx.visitorLetters).toHaveLength(1);
      expect(ctx.ownerEmails).toHaveLength(1);
      assertOwnerRelayOutbound(ctx.ownerEmails[0]!, "Sam Visitor");
    });
  });

  it("increments owner and visitor daily_send_counts on exchange", async () => {
    await withIsolatedLocalD1(async (db) => {
      const ctx = await setupRelayExchange(db, "direct", "lead-direct-counts");
      const owner = await db
        .prepare(
          `SELECT count FROM daily_send_counts WHERE day = ? AND card_id = ? AND kind = 'owner'`,
        )
        .bind(RELAY_E2E_DAY, ctx.card.id)
        .first<{ count: number }>();
      const visitor = await db
        .prepare(
          `SELECT count FROM daily_send_counts WHERE day = ? AND card_id = ? AND kind = 'visitor'`,
        )
        .bind(RELAY_E2E_DAY, ctx.card.id)
        .first<{ count: number }>();
      expect(owner?.count).toBe(1);
      expect(visitor?.count).toBe(1);
    });
  });
});
