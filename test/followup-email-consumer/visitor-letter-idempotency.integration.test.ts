import type { D1Database } from "@cloudflare/workers-types";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { CardEmailSnapshot } from "@/exchange/types";
import { createExchangeOwnerEmailStoreFromD1 } from "@/exchange-owner-email/d1-repository";
import { VISITOR_LETTER_SEND_CLAIM_STALE_MS } from "@/exchange-owner-email/types";
import { EXCHANGE_EMAIL_TRIGGER_DEFER_MAX_MS } from "@/exchange/owner-email-timing";
import { FollowupEmailError } from "@/email/followup-email-error";
import { createConsumerOutboundEmailSend } from "@/email/email-provider";
import {
  processFollowupQueueBatch,
  type FollowupConsumerDeps,
  type FollowupQueueMessage,
} from "@/followup-email-consumer/process-batch";
import { processLeadSinkQueueMessage } from "@/followup-email-consumer/process-lead-sink";
import { MAX_VISITOR_FOLLOWUP_ATTEMPTS } from "@/followup-email-consumer/retry";
import { createLeadSinkHandlerRegistry } from "@/followup-email-consumer/lead-sink/registry";
import { createEmailLeadSinkHandler } from "@/followup-email-consumer/lead-sink/email-handler";
import { MemoryConsumerLeadDeliveryLedger } from "./memory-consumer-ledger";
import { openIsolatedLocalD1 } from "../helpers/d1";
import { defaultLeadEmailControls } from "../helpers/lead-email-deps";

const LEAD_ID = "lead-letter-idem";
const CARD_ID = "card-letter-idem";
const TRIGGERED_AT = "2026-10-12T12:00:00.000Z";
const CREATED_AT = "2026-10-12T11:50:00.000Z";

const card: CardEmailSnapshot = {
  slug: "demo",
  displayName: "Demo Owner",
  email: "owner@example.com",
  photoKey: "photos/demo.jpg",
  contact: {
    name: { full: "Demo Owner", family: "Owner", given: "Demo", nickname: "Demo" },
    org: "Co",
    title: "Role",
    phone: "+1",
    vcardNote: "note",
    urls: [],
  },
  pageCopy: { emailFromName: "Demo at Example" },
};

function letterBody(type: "visitor_followup" | "visitor_letter_due") {
  return {
    type,
    lead: {
      leadId: LEAD_ID,
      submittedAt: CREATED_AT,
      environment: "preview",
      isTestLead: true,
      name: "Alex Visitor",
      email: "visitor@example.com",
      phone: null,
    },
    card,
  };
}

function queueMessage(
  body: unknown,
  overrides: Partial<FollowupQueueMessage> = {},
): FollowupQueueMessage {
  return {
    id: "msg-1",
    attempts: 1,
    body,
    ack: vi.fn(),
    retry: vi.fn(),
    ...overrides,
  };
}

async function seedExchangeRow(
  db: D1Database,
  overrides: {
    triggeredAt?: string | null;
    visitorLetterSentAt?: string | null;
    visitorLetterClaimedAt?: string | null;
    ownerEmailClaimedAt?: string | null;
  } = {},
) {
  await db
    .prepare(
      `INSERT INTO exchange_owner_email (
         lead_id, card_id, triggered_at,
         owner_email_claimed_at, owner_email_sent_at,
         visitor_letter_claimed_at, visitor_letter_sent_at,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
    )
    .bind(
      LEAD_ID,
      CARD_ID,
      overrides.triggeredAt ?? null,
      overrides.ownerEmailClaimedAt ?? null,
      overrides.visitorLetterClaimedAt ?? null,
      overrides.visitorLetterSentAt ?? null,
      CREATED_AT,
      CREATED_AT,
    )
    .run();
}

async function readLetterColumns(db: D1Database) {
  return db
    .prepare(
      `SELECT visitor_letter_sent_at, visitor_letter_claimed_at
       FROM exchange_owner_email WHERE lead_id = ?`,
    )
    .bind(LEAD_ID)
    .first<{
      visitor_letter_sent_at: string | null;
      visitor_letter_claimed_at: string | null;
    }>();
}

function createLetterConsumerDeps(
  db: D1Database,
  options: {
    now: () => Date;
    sendEmail?: ReturnType<typeof createConsumerOutboundEmailSend>;
    logExchangeVisitorLetterContentionExhausted?: ReturnType<typeof vi.fn>;
    logExchangeVisitorLetterSkippedPriorSend?: ReturnType<typeof vi.fn>;
    logExchangeOwnerEmailContentionExhausted?: ReturnType<typeof vi.fn>;
  },
): FollowupConsumerDeps {
  const emailSend = vi.fn(async () => ({ messageId: "m1", threadId: "t1" }));
  const sendEmail =
    options.sendEmail ??
    createConsumerOutboundEmailSend({
      EMAIL: { send: emailSend },
    });
  const exchangeOwnerEmail = createExchangeOwnerEmailStoreFromD1(db);
  const ledger = new MemoryConsumerLeadDeliveryLedger();
  const outboundFrom = { cloudflareFromEmail: "hello@mail.we-met.link" };
  const sinkHandlers = createLeadSinkHandlerRegistry({
    email: createEmailLeadSinkHandler({
      weMetEnv: "preview",
      testMailTo: "test-inbox@example.com",
      outboundFrom,
      fromDisplayName: "Platform at We Met",
      sendEmail,
      logMalformedLeadSink: vi.fn(),
    }),
  });

  return {
    readLeadEmailControls: async () => defaultLeadEmailControls,
    weMetEnv: "preview",
    baseUrl: "https://we-met.link",
    testMailTo: "test-inbox@example.com",
    outboundFrom,
    fromDisplayName: "Platform at We Met",
    sendEmail,
    ledger,
    sinkHandlers,
    exchangeOwnerEmail,
    now: options.now,
    assets: {
      get: vi.fn(async () => ({
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([0xff, 0xd8, 0xff]));
            controller.close();
          },
        }),
        contentType: "image/jpeg",
      })),
    },
    logVisitorFollowupAttemptFailure: vi.fn(),
    logVisitorFollowupPermanentFailure: vi.fn(),
    logMalformedVisitorFollowup: vi.fn(),
    logVisitorFollowupDroppedPaused: vi.fn(),
    logExchangeVisitorLetterRowMissing: vi.fn(),
    logExchangeVisitorLetterConfirmFailed: vi.fn(),
    logExchangeVisitorLetterContentionExhausted:
      options.logExchangeVisitorLetterContentionExhausted ?? vi.fn(),
    logExchangeVisitorLetterSkippedPriorSend:
      options.logExchangeVisitorLetterSkippedPriorSend ?? vi.fn(),
    logExchangeOwnerEmailContentionExhausted:
      options.logExchangeOwnerEmailContentionExhausted ?? vi.fn(),
    logUnsupportedType: vi.fn(),
    logMissingPhoto: vi.fn(),
    logNonJpegPhoto: vi.fn(),
    logLeadSinkAttemptFailure: vi.fn(),
    logLeadSinkPermanentFailure: vi.fn(),
    logMalformedLeadSink: vi.fn(),
    logLedgerRowMissing: vi.fn(),
    logLedgerUpdateFailed: vi.fn(),
    logLeadSinkLedgerRecordFailed: vi.fn(),
    logLeadSinkLedgerMarkFailed: vi.fn(),
    logLeadSinkAppendDeferred: vi.fn(),
    logExchangeOwnerEmailRowMissing: vi.fn(),
    logExchangeOwnerEmailConfirmFailed: vi.fn(),
  };
}

describe("visitor letter idempotency (local D1 integration)", () => {
  let db: D1Database;
  let closeD1: () => Promise<void>;

  beforeAll(async () => {
    const handle = await openIsolatedLocalD1();
    db = handle.db;
    closeD1 = handle.close;
  });

  afterAll(async () => {
    await closeD1?.();
  });

  beforeEach(async () => {
    await db.prepare(`DELETE FROM exchange_owner_email`).run();
  });

  it("(a) immediate letter then fallback after the defer window sends one letter", async () => {
    await seedExchangeRow(db, { triggeredAt: TRIGGERED_AT });
    let nowMs = Date.parse(TRIGGERED_AT);
    const sendEmail = vi.fn(async () => ({ messageId: "m1", threadId: "t1" }));
    const deps = createLetterConsumerDeps(db, {
      now: () => new Date(nowMs),
      sendEmail: createConsumerOutboundEmailSend({
        EMAIL: { send: sendEmail },
      }),
    });

    const immediate = queueMessage(letterBody("visitor_followup"));
    await processFollowupQueueBatch({ messages: [immediate] }, deps);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(immediate.ack).toHaveBeenCalledOnce();

    nowMs = Date.parse(TRIGGERED_AT) + EXCHANGE_EMAIL_TRIGGER_DEFER_MAX_MS + 60_000;
    const fallback = queueMessage(letterBody("visitor_letter_due"));
    await processFollowupQueueBatch({ messages: [fallback] }, deps);

    expect(sendEmail).toHaveBeenCalledOnce();
    expect(fallback.ack).toHaveBeenCalledOnce();
    const row = await readLetterColumns(db);
    expect(row?.visitor_letter_sent_at).not.toBeNull();
    expect(row?.visitor_letter_claimed_at).toBeNull();
  });

  it("(b) a redelivered duplicate sends one letter", async () => {
    await seedExchangeRow(db);
    const sendEmail = vi.fn(async () => ({ messageId: "m1", threadId: "t1" }));
    const deps = createLetterConsumerDeps(db, {
      now: () => new Date(TRIGGERED_AT),
      sendEmail: createConsumerOutboundEmailSend({
        EMAIL: { send: sendEmail },
      }),
    });

    const first = queueMessage(letterBody("visitor_followup"));
    const second = queueMessage(letterBody("visitor_followup"), { id: "msg-2" });
    await processFollowupQueueBatch({ messages: [first] }, deps);
    await processFollowupQueueBatch({ messages: [second] }, deps);

    expect(sendEmail).toHaveBeenCalledOnce();
    expect(first.ack).toHaveBeenCalledOnce();
    expect(second.ack).toHaveBeenCalledOnce();
  });

  it("(c) a stale claim plus redelivery sends exactly once", async () => {
    const staleClaimAt = "2026-10-12T11:00:00.000Z";
    const nowMs = Date.parse("2026-10-12T12:05:00.000Z");
    expect(nowMs - Date.parse(staleClaimAt)).toBeGreaterThan(
      VISITOR_LETTER_SEND_CLAIM_STALE_MS,
    );
    await seedExchangeRow(db, { visitorLetterClaimedAt: staleClaimAt });

    const sendEmail = vi.fn(async () => ({ messageId: "m1", threadId: "t1" }));
    const deps = createLetterConsumerDeps(db, {
      now: () => new Date(nowMs),
      sendEmail: createConsumerOutboundEmailSend({
        EMAIL: { send: sendEmail },
      }),
    });

    const redelivery = queueMessage(letterBody("visitor_letter_due"));
    await processFollowupQueueBatch({ messages: [redelivery] }, deps);

    expect(sendEmail).toHaveBeenCalledOnce();
    expect(redelivery.ack).toHaveBeenCalledOnce();
    const row = await readLetterColumns(db);
    expect(row?.visitor_letter_sent_at).not.toBeNull();
  });

  it("(d) a retryable failure releases the claim and the retry sends once", async () => {
    await seedExchangeRow(db);
    let attempt = 0;
    const sendEmail = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) {
        throw new FollowupEmailError("cloudflare_E_RATE_LIMIT_EXCEEDED");
      }
      return { messageId: "m1", threadId: "t1" };
    });
    const deps = createLetterConsumerDeps(db, {
      now: () => new Date(TRIGGERED_AT),
      sendEmail: createConsumerOutboundEmailSend({
        EMAIL: { send: sendEmail },
      }),
    });

    const firstTry = queueMessage(letterBody("visitor_followup"), { attempts: 1 });
    await processFollowupQueueBatch({ messages: [firstTry] }, deps);
    expect(firstTry.retry).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledOnce();

    const afterFailure = await readLetterColumns(db);
    expect(afterFailure?.visitor_letter_claimed_at).toBeNull();

    const retry = queueMessage(letterBody("visitor_followup"), { attempts: 2 });
    await processFollowupQueueBatch({ messages: [retry] }, deps);

    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(retry.ack).toHaveBeenCalledOnce();
    const afterSuccess = await readLetterColumns(db);
    expect(afterSuccess?.visitor_letter_sent_at).not.toBeNull();
  });

  it("(e) the letter fallback defers while triggered_at is set", async () => {
    await seedExchangeRow(db, { triggeredAt: TRIGGERED_AT });
    const nowInsideWindow = new Date(
      Date.parse(TRIGGERED_AT) + EXCHANGE_EMAIL_TRIGGER_DEFER_MAX_MS - 60_000,
    );
    const sendEmail = vi.fn(async () => ({ messageId: "m1", threadId: "t1" }));
    const deps = createLetterConsumerDeps(db, {
      now: () => nowInsideWindow,
      sendEmail: createConsumerOutboundEmailSend({
        EMAIL: { send: sendEmail },
      }),
    });

    const fallback = queueMessage(letterBody("visitor_letter_due"));
    await processFollowupQueueBatch({ messages: [fallback] }, deps);

    expect(sendEmail).not.toHaveBeenCalled();
    expect(fallback.retry).toHaveBeenCalledOnce();
    expect(fallback.ack).not.toHaveBeenCalled();
  });

  it("acks visitor_letter_due without send when visitor_letter_sent_at is already set", async () => {
    const sentAt = "2026-10-12T12:01:00.000Z";
    await seedExchangeRow(db, {
      triggeredAt: TRIGGERED_AT,
      visitorLetterSentAt: sentAt,
    });
    const logSkipped = vi.fn();
    const sendEmail = vi.fn(async () => ({ messageId: "m1", threadId: "t1" }));
    const deps = createLetterConsumerDeps(db, {
      now: () =>
        new Date(Date.parse(TRIGGERED_AT) + EXCHANGE_EMAIL_TRIGGER_DEFER_MAX_MS + 1),
      sendEmail: createConsumerOutboundEmailSend({
        EMAIL: { send: sendEmail },
      }),
      logExchangeVisitorLetterSkippedPriorSend: logSkipped,
    });

    const fallback = queueMessage(letterBody("visitor_letter_due"));
    await processFollowupQueueBatch({ messages: [fallback] }, deps);

    expect(sendEmail).not.toHaveBeenCalled();
    expect(logSkipped).toHaveBeenCalledWith(LEAD_ID);
    expect(fallback.ack).toHaveBeenCalledOnce();
  });

  it("logs exchange_visitor_letter_contention_exhausted when claim contention exhausts retries", async () => {
    const freshClaim = "2026-10-12T12:04:00.000Z";
    await seedExchangeRow(db, { visitorLetterClaimedAt: freshClaim });
    const logExhausted = vi.fn();
    const deps = createLetterConsumerDeps(db, {
      now: () => new Date("2026-10-12T12:05:00.000Z"),
      logExchangeVisitorLetterContentionExhausted: logExhausted,
    });

    const message = queueMessage(letterBody("visitor_letter_due"), {
      attempts: MAX_VISITOR_FOLLOWUP_ATTEMPTS,
    });
    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(logExhausted).toHaveBeenCalledWith(LEAD_ID);
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
  });

  it("logs exchange_owner_email_contention_exhausted when owner claim contention exhausts retries", async () => {
    const freshClaim = "2026-10-12T12:04:00.000Z";
    await seedExchangeRow(db, { ownerEmailClaimedAt: freshClaim });
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued(LEAD_ID, "sink-a", "record");
    const logExhausted = vi.fn();
    const exchangeOwnerEmail = createExchangeOwnerEmailStoreFromD1(db);
    const handler = createLeadSinkHandlerRegistry({
      email: createEmailLeadSinkHandler({
        weMetEnv: "preview",
        testMailTo: "test-inbox@example.com",
        outboundFrom: { cloudflareFromEmail: "hello@mail.we-met.link" },
        fromDisplayName: "Platform at We Met",
        sendEmail: createConsumerOutboundEmailSend({
          EMAIL: {
            send: vi.fn(async () => ({ messageId: "m1", threadId: "t1" })),
          },
        }),
        logMalformedLeadSink: vi.fn(),
      }),
    });

    const consumerDeps = {
      readLeadEmailControls: async () => defaultLeadEmailControls,
      exchangeOwnerEmail,
      sinkHandlers: handler,
      ledger,
      logUnsupportedType: vi.fn(),
      logMalformedLeadSink: vi.fn(),
      logLeadSinkAttemptFailure: vi.fn(),
      logLeadSinkPermanentFailure: vi.fn(),
      logLeadSinkLedgerRecordFailed: vi.fn(),
      logLeadSinkLedgerMarkFailed: vi.fn(),
      logLedgerRowMissing: vi.fn(),
      logLedgerUpdateFailed: vi.fn(),
      logLeadSinkAppendDeferred: vi.fn(),
      logExchangeOwnerEmailRowMissing: vi.fn(),
      logExchangeOwnerEmailConfirmFailed: vi.fn(),
      logExchangeOwnerEmailContentionExhausted: logExhausted,
      now: () => new Date("2026-10-12T12:05:00.000Z"),
    };

    const message = queueMessage(
      {
        type: "owner_email_due",
        sinkId: "sink-a",
        sinkKind: "email",
        sinkConfig: { to: "owner@example.com" },
        lead: letterBody("visitor_followup").lead,
        details: { phone: null, jobTitle: null, company: null, note: null },
        cardId: CARD_ID,
        cardSlug: "demo",
        sourceUrl: "https://we-met.link/hi/demo",
      },
      { attempts: MAX_VISITOR_FOLLOWUP_ATTEMPTS },
    );

    await processLeadSinkQueueMessage(message, consumerDeps);

    expect(logExhausted).toHaveBeenCalledWith(LEAD_ID);
    expect(message.ack).toHaveBeenCalledOnce();
  });
});
