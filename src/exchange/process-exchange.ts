import { resolveLeadSinksForDispatch } from "@/card-data/account-email";
import type { CardRecord, LeadSinkRecord } from "@/card-data/types";
import { buildCardEmailSnapshot } from "@/exchange/card-snapshot";
import {
  dispatchLeadOnExchange,
  type LeadDeliveryDispatchLogger,
  type LeadSinkDispatchDeps,
  type LeadSinkDispatchLogger,
} from "@/exchange/lead-sink/dispatcher";
import type { LeadDeliveryLedger } from "@/lead-delivery-ledger/types";
import type {
  FollowupEmailQueueProducer,
  LeadSinkQueueProducer,
} from "@/exchange/queue/producer";
import type { ExchangeRateLimiter } from "@/exchange/rate-limit";
import { createDetailsToken } from "@/exchange/token";
import type { TurnstileVerifier } from "@/exchange/turnstile";
import { absoluteUrl } from "@/config/we-met";
import type { ExchangeSuccessResponse, VisitorLead } from "@/exchange/types";
import type { ValidatedExchangeInput } from "@/exchange/validation";

export type ProcessExchangeDeps = {
  turnstile: TurnstileVerifier;
  rateLimiter: ExchangeRateLimiter;
  followupQueue: FollowupEmailQueueProducer;
  leadSinkQueue: LeadSinkQueueProducer;
  deliveryLedger: LeadDeliveryLedger;
  deliveryLogger: LeadDeliveryDispatchLogger;
  tokenSecret: string;
  environment: string;
  clientIp: string;
  leadSinkLogger: LeadSinkDispatchLogger;
  createLeadId: () => string;
  createLedgerId: () => string;
  now: () => Date;
  baseUrl: string;
};

export type ProcessExchangeResult =
  | { status: "success"; body: ExchangeSuccessResponse }
  | { status: "turnstile_failed" }
  | { status: "rate_limited" }
  | { status: "card_not_found" }
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
    phone: input.phone,
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

  const leadId = deps.createLeadId();
  const lead = buildVisitorLead(input, leadId, deps.environment, deps.now());
  const cardSnapshot = buildCardEmailSnapshot(card);

  const sinkDispatchDeps: LeadSinkDispatchDeps = {
    producer: deps.leadSinkQueue,
    sinkLogger: deps.leadSinkLogger,
    ledger: deps.deliveryLedger,
    deliveryLogger: deps.deliveryLogger,
    now: deps.now,
    createLedgerId: deps.createLedgerId,
  };

  const sourceUrl = absoluteUrl(deps.baseUrl, `/hi/${card.slug}`);
  await dispatchLeadOnExchange(
    resolveLeadSinksForDispatch(sinks, card.email),
    lead,
    card.id,
    card.slug,
    sourceUrl,
    sinkDispatchDeps,
  );

  try {
    await deps.followupQueue.enqueueVisitorFollowup({
      type: "visitor_followup",
      lead,
      card: cardSnapshot,
    });
  } catch {
    return { status: "enqueue_failed" };
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

  return { status: "success", body: { token } };
}
