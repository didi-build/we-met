import { resolveLeadSinksForDispatch } from "@/card-data/account-email";
import type { CardRecord, LeadSinkRecord } from "@/card-data/types";
import { buildCardEmailSnapshot } from "@/exchange/card-snapshot";
import {
  dispatchLeadOnExchange,
  type LeadDeliveryDispatchLogger,
  type LeadSinkDispatchDeps,
  type LeadSinkDispatchLogger,
} from "@/exchange/lead-sink/dispatcher";
import type { ExchangeOwnerEmailStore } from "@/exchange-owner-email/types";
import type { LeadDeliveryLedger } from "@/lead-delivery-ledger/types";
import type {
  FollowupEmailQueueProducer,
  LeadSinkQueueProducer,
} from "@/exchange/queue/producer";
import type { ExchangeRateLimiter } from "@/exchange/rate-limit";
import { createDetailsToken } from "@/exchange/token";
import type { TurnstileVerifier } from "@/exchange/turnstile";
import { absoluteUrl } from "@/config/we-met";
import { leadFirstNameFromFullName } from "@/email/email-template-vars";
import type { ExchangeSuccessResponse, VisitorLead } from "@/exchange/types";
import type { ValidatedExchangeInput } from "@/exchange/validation";
import type { VisitorEmailMode } from "@/app-settings/defaults";
import type { DailySendKind } from "@/lead-email/daily-send-counts";
import { utcDayFromDate } from "@/lead-email/daily-send-counts";

export type ProcessExchangeDeps = {
  turnstile: TurnstileVerifier;
  rateLimiter: ExchangeRateLimiter;
  followupQueue: FollowupEmailQueueProducer;
  leadSinkQueue: LeadSinkQueueProducer;
  deliveryLedger: LeadDeliveryLedger;
  exchangeOwnerEmail: ExchangeOwnerEmailStore;
  deliveryLogger: LeadDeliveryDispatchLogger;
  tokenSecret: string;
  environment: string;
  clientIp: string;
  leadSinkLogger: LeadSinkDispatchLogger;
  createLeadId: () => string;
  createLedgerId: () => string;
  now: () => Date;
  baseUrl: string;
  assertLeadEmailCapacity: (cardId: string, needed: number) => Promise<boolean>;
  readVisitorEmailMode: () => Promise<VisitorEmailMode>;
  incrementDailySendCounts: (
    cardId: string,
    kinds: readonly DailySendKind[],
  ) => Promise<void>;
};

export type ProcessExchangeResult =
  | { status: "success"; body: ExchangeSuccessResponse }
  | { status: "turnstile_failed" }
  | { status: "rate_limited" }
  | { status: "card_not_found" }
  | { status: "lead_email_unavailable" }
  | { status: "enqueue_failed" };

function buildVisitorLead(
  input: ValidatedExchangeInput,
  leadId: string,
  environment: string,
  now: Date,
): VisitorLead {
  const isTestLead = environment !== "production";
  return {
    leadId,
    submittedAt: now.toISOString(),
    environment,
    isTestLead,
    name: input.name,
    email: input.email,
    phone: null,
  };
}

export async function processExchange(
  input: ValidatedExchangeInput,
  card: CardRecord | null,
  sinks: LeadSinkRecord[],
  deps: ProcessExchangeDeps,
): Promise<ProcessExchangeResult> {
  if (!card) {
    return { status: "card_not_found" };
  }

  const turnstile = await deps.turnstile.verify(input.turnstileToken, deps.clientIp);
  if (!turnstile.success) {
    return { status: "turnstile_failed" };
  }

  const rate = await deps.rateLimiter.check(deps.clientIp);
  if (!rate.allowed) {
    return { status: "rate_limited" };
  }

  const visitorEmailMode = await deps.readVisitorEmailMode();
  const sendVisitorFollowupEmail = visitorEmailMode === "direct";
  const emailSlotsNeeded = sendVisitorFollowupEmail ? 2 : 1;

  if (!(await deps.assertLeadEmailCapacity(card.id, emailSlotsNeeded))) {
    return { status: "lead_email_unavailable" };
  }

  const leadId = deps.createLeadId();
  const lead = buildVisitorLead(input, leadId, deps.environment, deps.now());
  const cardSnapshot = buildCardEmailSnapshot(card);

  const day = utcDayFromDate(deps.now());
  const enabledSinks = sinks.filter((s) => s.enabled);
  const dailySendKinds: DailySendKind[] = sendVisitorFollowupEmail
    ? ["owner", "visitor"]
    : ["owner"];
  const sinkDispatchDeps: LeadSinkDispatchDeps = {
    producer: deps.leadSinkQueue,
    sinkLogger: deps.leadSinkLogger,
    ledger: deps.deliveryLedger,
    exchangeOwnerEmail: deps.exchangeOwnerEmail,
    deliveryLogger: deps.deliveryLogger,
    now: deps.now,
    createLedgerId: deps.createLedgerId,
    dailySendOnFirstLedger:
      enabledSinks.length > 0
        ? { day, cardId: card.id, kinds: dailySendKinds }
        : undefined,
  };

  const sourceUrl = absoluteUrl(deps.baseUrl, `/hi/${card.slug}`);
  await dispatchLeadOnExchange(
    resolveLeadSinksForDispatch(sinks, card.email),
    lead,
    card.id,
    card.slug,
    sourceUrl,
    leadFirstNameFromFullName(card.displayName),
    sinkDispatchDeps,
  );

  if (enabledSinks.length === 0) {
    await deps.incrementDailySendCounts(card.id, dailySendKinds);
  }

  if (sendVisitorFollowupEmail) {
    try {
      await deps.followupQueue.enqueueVisitorFollowup({
        type: "visitor_followup",
        lead,
        card: cardSnapshot,
      });
    } catch {
      return { status: "enqueue_failed" };
    }
  }

  const token = createDetailsToken(
    deps.tokenSecret,
    {
      leadId,
      cardId: card.id,
      cardSlug: card.slug,
      visitorEmail: lead.email,
      visitorName: lead.name,
    },
    Math.floor(deps.now().getTime() / 1000),
  );

  const body: ExchangeSuccessResponse = {
    token,
    ownerEmail: card.email,
  };
  const ownerPhone = card.contact.phone.trim();
  if (ownerPhone) {
    body.ownerPhone = ownerPhone;
  }

  return { status: "success", body };
}
