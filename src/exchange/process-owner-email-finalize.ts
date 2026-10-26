import { resolveLeadSinksForDispatch } from "@/card-data/account-email";
import type { CardRecord, LeadSinkRecord } from "@/card-data/types";
import { buildCardEmailSnapshot } from "@/exchange/card-snapshot";
import type { ExchangeOwnerEmailStore } from "@/exchange-owner-email/types";
import {
  dispatchOwnerEmailImmediate,
  type LeadDeliveryDispatchLogger,
  type LeadSinkDispatchDeps,
  type LeadSinkDispatchLogger,
} from "@/exchange/lead-sink/dispatcher";
import { leadFirstNameFromFullName } from "@/email/email-template-vars";
import type { LeadDeliveryLedger } from "@/lead-delivery-ledger/types";
import type {
  FollowupEmailQueueProducer,
  LeadSinkQueueProducer,
} from "@/exchange/queue/producer";
import { absoluteUrl } from "@/config/we-met";
import type { VisitorEmailMode } from "@/app-settings/defaults";
import { relayContactCardTokenForEnqueue } from "@/exchange/relay-contact-card-token";
import type { VisitorLead, VisitorLeadDetails } from "@/exchange/types";

export type ProcessOwnerEmailFinalizeDeps = {
  tokenSecret: string;
  resolveVisitorEmailMode: () => Promise<VisitorEmailMode>;
  followupQueue: FollowupEmailQueueProducer;
  leadSinkQueue: LeadSinkQueueProducer;
  deliveryLedger: LeadDeliveryLedger;
  deliveryLogger: LeadDeliveryDispatchLogger;
  leadSinkLogger: LeadSinkDispatchLogger;
  exchangeOwnerEmail: ExchangeOwnerEmailStore;
  createLedgerId: () => string;
  now: () => Date;
  baseUrl: string;
  logExchangeVisitorLetterEnqueueFailed(leadId: string): void;
};

export type ProcessOwnerEmailFinalizeResult =
  { status: "success" } | { status: "already_finalized" };

const EMPTY_DETAILS: VisitorLeadDetails = {
  phone: null,
  jobTitle: null,
  company: null,
  note: null,
};

export async function processOwnerEmailFinalize(
  lead: VisitorLead,
  details: VisitorLeadDetails | null,
  card: CardRecord,
  sinks: LeadSinkRecord[],
  deps: ProcessOwnerEmailFinalizeDeps,
): Promise<ProcessOwnerEmailFinalizeResult> {
  let visitorEmailMode: VisitorEmailMode = "direct";
  try {
    visitorEmailMode = await deps.resolveVisitorEmailMode();
  } catch {
    visitorEmailMode = "direct";
  }

  let relayContactCardToken: string | undefined;
  try {
    relayContactCardToken = relayContactCardTokenForEnqueue(
      deps.tokenSecret,
      visitorEmailMode,
      lead.leadId,
      card.id,
    );
  } catch {
    if (visitorEmailMode === "owner_relay") {
      console.error("relay_contact_card_token_failed", {
        leadId: lead.leadId,
        cardId: card.id,
      });
    }
    relayContactCardToken = undefined;
  }

  const triggeredAt = deps.now().toISOString();
  await deps.exchangeOwnerEmail.ensurePending({
    leadId: lead.leadId,
    cardId: card.id,
    createdAt: triggeredAt,
  });
  const newlyTriggered = await deps.exchangeOwnerEmail.trySetTriggeredAt({
    leadId: lead.leadId,
    triggeredAt,
  });
  if (!newlyTriggered) {
    return { status: "already_finalized" };
  }

  const cardSnapshot = buildCardEmailSnapshot(card);
  try {
    await deps.followupQueue.enqueueVisitorLetter({
      type: "visitor_followup",
      lead,
      card: cardSnapshot,
      ...(relayContactCardToken ? { relayContactCardToken } : {}),
    });
  } catch {
    deps.logExchangeVisitorLetterEnqueueFailed(lead.leadId);
  }

  const sourceUrl = absoluteUrl(deps.baseUrl, `/hi/${card.slug}`);
  const sinksForDispatch = resolveLeadSinksForDispatch(sinks, card.email);
  const sinkDispatchDeps: LeadSinkDispatchDeps = {
    producer: deps.leadSinkQueue,
    sinkLogger: deps.leadSinkLogger,
    ledger: deps.deliveryLedger,
    deliveryLogger: deps.deliveryLogger,
    exchangeOwnerEmail: deps.exchangeOwnerEmail,
    now: deps.now,
    createLedgerId: deps.createLedgerId,
  };

  await dispatchOwnerEmailImmediate(
    sinksForDispatch,
    lead,
    details ?? EMPTY_DETAILS,
    card.id,
    card.slug,
    sourceUrl,
    leadFirstNameFromFullName(card.displayName),
    sinkDispatchDeps,
  );

  return { status: "success" };
}
