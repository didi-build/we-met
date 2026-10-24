import { describe, expect, it } from "vitest";
import { lookupCard } from "@/card-data/lookup";
import { D1CardRepository } from "@/card-data/d1-repository";
import { processVCardDownload } from "@/exchange/process-vcard";
import { parseExchangeBody } from "@/exchange/validation";
import { withIsolatedLocalD1 } from "../helpers/d1";
import {
  assertDirectOwnerOutbound,
  assertOwnerRelayOutbound,
  deliverAllSinkMessages,
  deliverVisitorFollowups,
  finalizeWithDetails,
  finalizeWithDismiss,
  RELAY_E2E_CARD_SLUG,
  RELAY_E2E_DAY,
  RELAY_E2E_OWNER_EMAIL,
  setupRelayExchange,
} from "../helpers/relay-exchange-e2e";

const hostConfig = {
  baseUrl: "https://we-met.link",
  previewHostSuffix: "-we-met.example.workers.dev",
  weMetEnv: "production",
};

describe("relay exchange path (owner_relay, integration)", () => {
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

  it("sends exactly one owner relay email when details are submitted", async () => {
    await withIsolatedLocalD1(async (db) => {
      const ctx = await setupRelayExchange(db);
      await finalizeWithDetails(ctx, {
        phone: "+1 555 0102",
        jobTitle: "Engineer",
        company: "Acme",
        note: "Met at demo",
      });
      await deliverAllSinkMessages(ctx);
      expect(ctx.ownerEmails).toHaveLength(1);
      assertOwnerRelayOutbound(ctx.ownerEmails[0]!, "Sam Visitor");
      expect(ctx.ownerEmails[0]!.textPlain).toContain("Phone:     +1 555 0102");
      expect(ctx.ownerEmails[0]!.textPlain).toContain("Job title: Engineer");
      expect(ctx.followupMessages).toHaveLength(0);
      expect(ctx.visitorEmails).toHaveLength(0);
    });
  });

  it("sends exactly one owner relay email when details are dismissed", async () => {
    await withIsolatedLocalD1(async (db) => {
      const ctx = await setupRelayExchange(db);
      await finalizeWithDismiss(ctx);
      await deliverAllSinkMessages(ctx);
      expect(ctx.ownerEmails).toHaveLength(1);
      assertOwnerRelayOutbound(ctx.ownerEmails[0]!, "Sam Visitor");
      expect(ctx.ownerEmails[0]!.textPlain).not.toContain("Phone:");
      expect(ctx.ownerEmails[0]!.textPlain).not.toContain("Job title:");
    });
  });

  it("sends exactly one owner relay email on the 10-minute fallback only", async () => {
    await withIsolatedLocalD1(async (db) => {
      const ctx = await setupRelayExchange(db);
      await deliverAllSinkMessages(ctx);
      expect(ctx.ownerEmails).toHaveLength(1);
      assertOwnerRelayOutbound(ctx.ownerEmails[0]!, "Sam Visitor");
      expect(ctx.ownerEmails[0]!.textPlain).not.toContain("Phone:");
    });
  });

  it("does not send twice when immediate and fallback queue messages are both delivered", async () => {
    await withIsolatedLocalD1(async (db) => {
      const ctx = await setupRelayExchange(db);
      await finalizeWithDetails(ctx, {
        phone: null,
        jobTitle: null,
        company: null,
        note: null,
      });
      await deliverAllSinkMessages(ctx);
      expect(ctx.ownerEmails).toHaveLength(1);
    });
  });

  it("counts only the owner slot in daily_send_counts and sends no visitor mail", async () => {
    await withIsolatedLocalD1(async (db) => {
      const ctx = await setupRelayExchange(db);
      await finalizeWithDismiss(ctx);
      await deliverAllSinkMessages(ctx);
      await deliverVisitorFollowups(ctx, ctx.visitorEmails);
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
      expect(visitor).toBeNull();
      expect(ctx.visitorEmails).toHaveLength(0);
    });
  });

  it("returns the owner vCard from the token-gated download route", async () => {
    await withIsolatedLocalD1(async (db) => {
      const ctx = await setupRelayExchange(db);
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
});

describe("relay exchange path (direct visitor_email_mode, integration)", () => {
  it("sends visitor follow-up with vCard and one owner email without threading", async () => {
    await withIsolatedLocalD1(async (db) => {
      const ctx = await setupRelayExchange(db, "direct");
      expect(ctx.followupMessages).toHaveLength(1);
      await finalizeWithDetails(ctx, {
        phone: "+1 555 0102",
        jobTitle: "Engineer",
        company: "Acme",
        note: "Note",
      });
      await deliverAllSinkMessages(ctx);
      await deliverVisitorFollowups(ctx, ctx.visitorEmails);
      expect(ctx.ownerEmails).toHaveLength(1);
      assertDirectOwnerOutbound(ctx.ownerEmails[0]!, "Sam Visitor");
      expect(ctx.visitorEmails).toHaveLength(1);
      const visitor = ctx.visitorEmails[0]!;
      expect(visitor.to).toBe("visitor@example.com");
      expect(visitor.attachments?.[0]?.filename).toMatch(/\.vcf$/);
      const vcardBody = visitor.attachments?.[0]?.body ?? "";
      expect(vcardBody).toContain("BEGIN:VCARD");
      expect(vcardBody).toContain(RELAY_E2E_OWNER_EMAIL);
    });
  });

  it("delivers only one owner email when fallback and immediate owner messages are processed", async () => {
    await withIsolatedLocalD1(async (db) => {
      const ctx = await setupRelayExchange(db, "direct", "lead-direct-dup");
      await finalizeWithDismiss(ctx);
      await deliverAllSinkMessages(ctx);
      expect(ctx.ownerEmails).toHaveLength(1);
      assertDirectOwnerOutbound(ctx.ownerEmails[0]!, "Sam Visitor");
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
