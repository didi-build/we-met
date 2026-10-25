import { expect, vi } from "vitest";
import { publishCard, saveDraft } from "@/app-card/card-store";
import { readLeadEmailControls } from "@/app-settings/caps";
import {
  APP_SETTING_DAILY_CAP_GLOBAL,
  APP_SETTING_DAILY_CAP_PER_CARD,
  APP_SETTING_LEAD_EMAIL_ENABLED,
  APP_SETTING_VISITOR_EMAIL_MODE,
  type VisitorEmailMode,
} from "@/app-settings/defaults";
import { resolveLeadSinksForDispatch } from "@/card-data/account-email";
import { D1CardRepository } from "@/card-data/d1-repository";
import type { CardRecord, LeadSinkRecord } from "@/card-data/types";
import { createExchangeOwnerEmailStoreFromD1 } from "@/exchange-owner-email/d1-repository";
import type { OutboundEmail } from "@/email/types";
import { createEmailLeadSinkHandler } from "@/followup-email-consumer/lead-sink/email-handler";
import { createLeadSinkHandlerRegistry } from "@/followup-email-consumer/lead-sink/registry";
import { createConsumerLeadDeliveryLedger } from "@/followup-email-consumer/lead-delivery-ledger";
import {
  processFollowupQueueBatch,
  type FollowupQueueMessage,
} from "@/followup-email-consumer/process-batch";
import { processLeadSinkQueueMessage } from "@/followup-email-consumer/process-lead-sink";
import { createLeadDeliveryLedgerFromD1 } from "@/lead-delivery-ledger/d1-repository";
import { assertLeadEmailCapacity } from "@/lead-email/availability";
import {
  incrementDailySendCounts,
  utcDayFromDate,
} from "@/lead-email/daily-send-counts";
import { processDetails } from "@/exchange/process-details";
import { processDetailsDismiss } from "@/exchange/process-details-dismiss";
import { processExchange, type ProcessExchangeDeps } from "@/exchange/process-exchange";
import type { EditorCard } from "@/app-api/types";
import type { QueueSendOptions } from "@/exchange/queue/producer";
import { OWNER_EMAIL_FALLBACK_DELAY_SECONDS } from "@/exchange/owner-email-timing";

export const RELAY_E2E_ACCOUNT_ID = "acct-relay-e2e";
export const RELAY_E2E_OWNER_EMAIL = "relay-owner@example.com";
export const RELAY_E2E_CARD_SLUG = "relay-e2e-card";
export const RELAY_E2E_NOW = new Date("2026-10-12T12:00:00.000Z");
export const RELAY_E2E_DAY = utcDayFromDate(RELAY_E2E_NOW);

type D1Database = import("@cloudflare/workers-types").D1Database;

export type QueuedSinkMessage = { message: unknown; options?: QueueSendOptions };

export type RelayE2EContext = {
  db: D1Database;
  card: CardRecord;
  sinks: LeadSinkRecord[];
  sinkMessages: QueuedSinkMessage[];
  followupMessages: unknown[];
  exchangeDeps: ProcessExchangeDeps;
  ownerEmails: OutboundEmail[];
  visitorLetters: OutboundEmail[];
  leadId: string;
  detailsToken: string;
};

async function seedAppSettings(
  db: D1Database,
  visitorEmailMode?: VisitorEmailMode,
): Promise<void> {
  const rows: Record<string, string> = {
    [APP_SETTING_LEAD_EMAIL_ENABLED]: "1",
    [APP_SETTING_DAILY_CAP_GLOBAL]: "500",
    [APP_SETTING_DAILY_CAP_PER_CARD]: "100",
  };
  if (visitorEmailMode) {
    rows[APP_SETTING_VISITOR_EMAIL_MODE] = visitorEmailMode;
  }
  for (const [key, value] of Object.entries(rows)) {
    await db
      .prepare(
        `INSERT INTO app_settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .bind(key, value)
      .run();
  }
}

function editorCard(): EditorCard {
  return {
    slug: RELAY_E2E_CARD_SLUG,
    name: "Relay Owner",
    role: "Founder",
    photo: "",
    about: ["About paragraph."],
    services: Array.from({ length: 10 }, (_, i) => ({
      title: `Service ${i}`,
      description: "Desc",
    })),
    links: {
      website: "https://example.com",
      linkedin: "https://linkedin.com/in/relay",
      github: "",
      instagram: "",
    },
    phone: "+1 555 0199",
    alternate: { url: "", label: "" },
  };
}

export async function seedRelayPublishedCard(db: D1Database): Promise<void> {
  const now = RELAY_E2E_NOW.toISOString();
  await db
    .prepare(
      `INSERT INTO accounts (id, google_sub, email, name, status, created_at, updated_at)
       VALUES (?, 'sub-relay-e2e', ?, 'Relay Google Name', 'active', ?, ?)`,
    )
    .bind(RELAY_E2E_ACCOUNT_ID, RELAY_E2E_OWNER_EMAIL, now, now)
    .run();
  const card = editorCard();
  await saveDraft(db, RELAY_E2E_ACCOUNT_ID, card);
  await publishCard(db, RELAY_E2E_ACCOUNT_ID, card, null);
}

function createLeadSinkConsumerDeps(
  db: D1Database,
  ownerEmails: OutboundEmail[],
  visitorEmailMode: VisitorEmailMode,
) {
  const sendOwner = vi.fn(async (message: OutboundEmail) => {
    ownerEmails.push(message);
    return { messageId: "<owner-msg@mail.we-met.link>", threadId: null };
  });
  const handler = createEmailLeadSinkHandler({
    weMetEnv: "production",
    outboundFrom: { cloudflareFromEmail: "hello@mail.we-met.link" },
    fromDisplayName: "We Met",
    sendEmail: sendOwner,
    logMalformedLeadSink: vi.fn(),
  });
  return {
    readLeadEmailControls: async () => {
      const controls = await readLeadEmailControls(db);
      return { ...controls, visitorEmailMode };
    },
    exchangeOwnerEmail: createExchangeOwnerEmailStoreFromD1(db),
    sinkHandlers: createLeadSinkHandlerRegistry({ email: handler }),
    ledger: createConsumerLeadDeliveryLedger(db),
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
    logExchangeOwnerEmailContentionExhausted: vi.fn(),
    now: () => RELAY_E2E_NOW,
  };
}

function queueMessage(body: unknown): FollowupQueueMessage {
  return {
    id: crypto.randomUUID(),
    attempts: 1,
    body,
    ack: vi.fn(),
    retry: vi.fn(),
  };
}

export function ownerSinkDeliveryOrder(
  messages: QueuedSinkMessage[],
): QueuedSinkMessage[] {
  return [...messages].sort((a, b) => {
    const typeA = (a.message as { type?: string }).type ?? "";
    const typeB = (b.message as { type?: string }).type ?? "";
    if (typeA === typeB) {
      return 0;
    }
    if (typeA === "lead_sink_owner_email") {
      return -1;
    }
    if (typeB === "lead_sink_owner_email") {
      return 1;
    }
    return 0;
  });
}

export async function deliverAllSinkMessages(ctx: RelayE2EContext): Promise<void> {
  const consumerDeps = createLeadSinkConsumerDeps(
    ctx.db,
    ctx.ownerEmails,
    (await readLeadEmailControls(ctx.db)).visitorEmailMode,
  );
  for (const queued of ownerSinkDeliveryOrder(ctx.sinkMessages)) {
    await processLeadSinkQueueMessage(queueMessage(queued.message), consumerDeps);
  }
}

export async function deliverVisitorLetters(
  ctx: RelayE2EContext,
  letterOutbox: OutboundEmail[],
): Promise<void> {
  const sendVisitor = vi.fn(async (message: OutboundEmail) => {
    letterOutbox.push(message);
    return { messageId: "<visitor-msg@mail.we-met.link>", threadId: null };
  });
  const controls = await readLeadEmailControls(ctx.db);
  await processFollowupQueueBatch(
    {
      messages: ctx.followupMessages.map((body) => queueMessage(body)),
    },
    {
      readLeadEmailControls: async () => controls,
      weMetEnv: "production",
      baseUrl: "https://we-met.link",
      testMailTo: "test-inbox@example.com",
      outboundFrom: { cloudflareFromEmail: "hello@mail.we-met.link" },
      fromDisplayName: "We Met",
      sendEmail: sendVisitor,
      ledger: createConsumerLeadDeliveryLedger(ctx.db),
      exchangeOwnerEmail: createExchangeOwnerEmailStoreFromD1(ctx.db),
      sinkHandlers: new Map(),
      assets: { get: vi.fn(async () => null) },
      logVisitorFollowupAttemptFailure: vi.fn(),
      logVisitorFollowupPermanentFailure: vi.fn(),
      logMalformedVisitorFollowup: vi.fn(),
      logVisitorFollowupDroppedPaused: vi.fn(),
      logExchangeVisitorLetterRowMissing: vi.fn(),
      logExchangeVisitorLetterConfirmFailed: vi.fn(),
      logExchangeVisitorLetterContentionExhausted: vi.fn(),
      logExchangeVisitorLetterSkippedPriorSend: vi.fn(),
      logExchangeOwnerEmailContentionExhausted: vi.fn(),
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
      now: () => RELAY_E2E_NOW,
    },
  );
}

/** Visitor letter first, then owner relay email (best effort). */
export async function deliverAllExchangeEmails(ctx: RelayE2EContext): Promise<void> {
  await deliverVisitorLetters(ctx, ctx.visitorLetters);
  await deliverAllSinkMessages(ctx);
}

function finalizeDeps(ctx: RelayE2EContext) {
  return {
    tokenSecret: ctx.exchangeDeps.tokenSecret,
    resolveVisitorEmailMode: ctx.exchangeDeps.resolveVisitorEmailMode,
    environment: ctx.exchangeDeps.environment,
    followupQueue: ctx.exchangeDeps.followupQueue,
    leadSinkQueue: ctx.exchangeDeps.leadSinkQueue,
    deliveryLedger: ctx.exchangeDeps.deliveryLedger,
    deliveryLogger: ctx.exchangeDeps.deliveryLogger,
    leadSinkLogger: ctx.exchangeDeps.leadSinkLogger,
    exchangeOwnerEmail: ctx.exchangeDeps.exchangeOwnerEmail,
    createLedgerId: ctx.exchangeDeps.createLedgerId,
    now: ctx.exchangeDeps.now,
    baseUrl: ctx.exchangeDeps.baseUrl,
    logExchangeVisitorLetterEnqueueFailed:
      ctx.exchangeDeps.logExchangeVisitorLetterEnqueueFailed,
  };
}

export async function setupRelayExchange(
  db: D1Database,
  visitorEmailMode?: VisitorEmailMode,
  leadId = "lead-relay-e2e-1",
): Promise<RelayE2EContext> {
  await seedAppSettings(db, visitorEmailMode);
  await seedRelayPublishedCard(db);
  const repo = new D1CardRepository(db);
  const card = await repo.getBySlug(RELAY_E2E_CARD_SLUG);
  if (!card) {
    throw new Error("published card missing");
  }
  const sinks = resolveLeadSinksForDispatch(
    await repo.listLeadSinks(card.id),
    card.email,
  );
  const sinkMessages: QueuedSinkMessage[] = [];
  const followupMessages: unknown[] = [];
  const ledger = createLeadDeliveryLedgerFromD1(db);
  const now = () => RELAY_E2E_NOW;
  const exchangeDeps: ProcessExchangeDeps = {
    turnstile: { verify: async () => ({ success: true }) },
    rateLimiter: { check: async () => ({ allowed: true }) },
    followupQueue: {
      enqueueVisitorLetter: async (message) => {
        followupMessages.push(message);
      },
    },
    leadSinkQueue: {
      enqueueLeadSink: async (message, options) => {
        sinkMessages.push({ message, options });
      },
    },
    deliveryLedger: ledger,
    exchangeOwnerEmail: createExchangeOwnerEmailStoreFromD1(db),
    deliveryLogger: {
      logLedgerWriteFailed: vi.fn(),
      logLedgerEnqueueFailed: vi.fn(),
    },
    tokenSecret: "relay-e2e-secret",
    environment: "preview",
    clientIp: "203.0.113.50",
    leadSinkLogger: { logSinkEnqueueFailure: vi.fn() },
    createLeadId: () => leadId,
    createLedgerId: () => `ledger-${leadId}`,
    now,
    baseUrl: "https://we-met.link",
    assertLeadEmailCapacity: (cardId, needed) =>
      assertLeadEmailCapacity(db, cardId, needed, now()),
    incrementDailySendCounts: (cardId, kinds) =>
      incrementDailySendCounts(db, RELAY_E2E_DAY, cardId, kinds),
    logExchangeVisitorLetterEnqueueFailed: vi.fn(),
    resolveVisitorEmailMode: async (): Promise<VisitorEmailMode> =>
      visitorEmailMode ?? "owner_relay",
  };

  const exchange = await processExchange(
    {
      slug: card.slug,
      name: "Sam Visitor",
      email: "visitor@example.com",
      turnstileToken: "tok",
    },
    card,
    sinks,
    exchangeDeps,
  );
  if (exchange.status !== "success") {
    throw new Error(`exchange failed: ${exchange.status}`);
  }

  return {
    db,
    card,
    sinks,
    sinkMessages,
    followupMessages,
    exchangeDeps,
    ownerEmails: [],
    visitorLetters: [],
    leadId,
    detailsToken: exchange.body.token,
  };
}

export async function finalizeWithDetails(
  ctx: RelayE2EContext,
  details: {
    phone: string | null;
    jobTitle: string | null;
    company: string | null;
    note: string | null;
  },
): Promise<void> {
  const result = await processDetails(
    { token: ctx.detailsToken, ...details },
    ctx.card,
    ctx.sinks,
    finalizeDeps(ctx),
  );
  if (result.status !== "success") {
    throw new Error(`details failed: ${result.status}`);
  }
}

export async function tryFinalizeWithDetails(
  ctx: RelayE2EContext,
  details: {
    phone: string | null;
    jobTitle: string | null;
    company: string | null;
    note: string | null;
  },
) {
  return processDetails({ token: ctx.detailsToken, ...details }, ctx.card, ctx.sinks, {
    ...finalizeDeps(ctx),
  });
}

export async function tryFinalizeWithDismiss(ctx: RelayE2EContext) {
  return processDetailsDismiss({ token: ctx.detailsToken }, ctx.card, ctx.sinks, {
    ...finalizeDeps(ctx),
  });
}

export async function finalizeWithDismiss(ctx: RelayE2EContext): Promise<void> {
  const result = await processDetailsDismiss(
    { token: ctx.detailsToken },
    ctx.card,
    ctx.sinks,
    finalizeDeps(ctx),
  );
  if (result.status !== "success") {
    throw new Error(`dismiss failed: ${result.status}`);
  }
}

export function assertOwnerRelayOutbound(
  email: OutboundEmail,
  visitorName: string,
): void {
  expect(email.to).toBe(RELAY_E2E_OWNER_EMAIL);
  expect(email.replyTo).toBe("visitor@example.com");
  expect(email.subject).toBe(`You met ${visitorName}`);
  expect(email.inReplyTo).toBeUndefined();
  expect(email.references).toBeUndefined();
  expect(email.subject).not.toMatch(/^Re:/);
  expect(email.textPlain).toContain("Hit Reply to write back");
  expect(email.textPlain).not.toContain("Re: New lead");
  expect(email.textPlain).not.toMatch(/Phone:\s+-/);
}

/** Optional relay rows (phone, job title, company, note) omitted when unset; no dash placeholders. */
export function assertOwnerRelayOmitsEmptyOptionalRows(email: OutboundEmail): void {
  const { textPlain, textHtml } = email;
  for (const label of ["Phone:", "Job title:", "Company:", "Note:"]) {
    expect(textPlain).not.toContain(label);
  }
  expect(textPlain).not.toMatch(/Phone:\s+-/);
  expect(textPlain).not.toMatch(/Job title:\s+-/);
  expect(textPlain).not.toMatch(/Company:\s+-/);
  expect(textPlain).not.toMatch(/Note:\s*\n\s*-/);
  expect(textHtml).not.toContain(">Phone</td>");
  expect(textHtml).not.toContain(">Job title</td>");
  expect(textHtml).not.toContain(">Company</td>");
  expect(textHtml).not.toContain(">Note</td>");
}

export function assertVisitorLetterToOwner(email: OutboundEmail): void {
  expect(email.to).toBe(RELAY_E2E_OWNER_EMAIL);
  expect(email.replyTo).toBe("visitor@example.com");
  expect(email.subject).toBe("Great meeting you, Sam");
  expect(email.attachments?.[0]?.filename).toMatch(/\.vcf$/);
  expect(email.textPlain).toContain("If it is missing when you reply");
  expect(email.textHtml).toContain("save my contact card");
  expect(email.textPlain).toMatch(/\/api\/exchange\/[^/\s]+\/contact-card\?token=/);
  expect(email.textPlain).not.toContain("visitor@example.com");
  expect(email.textPlain).not.toContain("Engineer");
  expect(email.textPlain).not.toContain("Acme");
}

export function assertVisitorLetterToVisitor(email: OutboundEmail): void {
  expect(email.to).toBe("visitor@example.com");
  expect(email.replyTo).toBe(RELAY_E2E_OWNER_EMAIL);
  expect(email.subject).toBe("Great meeting you, Sam");
  expect(email.attachments?.[0]?.filename).toMatch(/\.vcf$/);
}

export function assertDelayedFallbacksQueuedOnExchange(ctx: RelayE2EContext): void {
  expect(ctx.followupMessages).toHaveLength(1);
  expect((ctx.followupMessages[0] as { type?: string }).type).toBe(
    "visitor_letter_due",
  );
  expect(ctx.sinkMessages).toHaveLength(1);
  const ownerDue = ctx.sinkMessages[0]!;
  expect((ownerDue.message as { type?: string }).type).toBe("owner_email_due");
  expect(ownerDue.options?.delaySeconds).toBe(OWNER_EMAIL_FALLBACK_DELAY_SECONDS);
}

async function consumerDepsForOwnerDelivery(
  ctx: RelayE2EContext,
  ownerEmails: OutboundEmail[],
) {
  const controls = await readLeadEmailControls(ctx.db);
  return createLeadSinkConsumerDeps(ctx.db, ownerEmails, controls.visitorEmailMode);
}

export async function deliverOwnerSinkBodyTwiceWithRetry(
  ctx: RelayE2EContext,
  body: unknown,
): Promise<void> {
  const deps = await consumerDepsForOwnerDelivery(ctx, ctx.ownerEmails);
  const first = {
    id: "owner-sink-1",
    attempts: 1,
    body,
    ack: vi.fn(),
    retry: vi.fn(),
  };
  const second = {
    id: "owner-sink-2",
    attempts: 2,
    body,
    ack: vi.fn(),
    retry: vi.fn(),
  };
  await processLeadSinkQueueMessage(first, deps);
  await processLeadSinkQueueMessage(second, deps);
}

/** @deprecated Use {@link assertOwnerRelayOutbound}; direct mode uses the same owner template. */
export const assertDirectOwnerOutbound = assertOwnerRelayOutbound;
