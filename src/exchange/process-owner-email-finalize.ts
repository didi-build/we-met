import { resolveLeadSinksForDispatch } from "@/card-data/account-email";
import type { CardRecord, LeadSinkRecord } from "@/card-data/types";
import type { ExchangeOwnerEmailStore } from "@/exchange-owner-email/types";
import {
  dispatchOwnerEmailImmediate,
  type LeadDeliveryDispatchLogger,
  type LeadSinkDispatchDeps,
  type LeadSinkDispatchLogger,
} from "@/exchange/lead-sink/dispatcher";
import { leadFirstNameFromFullName } from "@/email/email-template-vars";
import type { LeadDeliveryLedger } from "@/lead-delivery-ledger/types";
import type { LeadSinkQueueProducer } from "@/exchange/queue/producer";
import { absoluteUrl } from "@/config/we-met";
import type { VisitorLead, VisitorLeadDetails } from "@/exchange/types";

export type ProcessOwnerEmailFinalizeDeps = {
  leadSinkQueue: LeadSinkQueueProducer;
  deliveryLedger: LeadDeliveryLedger;
  deliveryLogger: LeadDeliveryDispatchLogger;
  leadSinkLogger: LeadSinkDispatchLogger;
  exchangeOwnerEmail: ExchangeOwnerEmailStore;
  createLedgerId: () => string;
  now: () => Date;
  baseUrl: string;
};

export type ProcessOwnerEmailFinalizeResult =
  { status: "success" } | { status: "already_finalized" } | { status: "server_error" };

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
  const finalizedAt = deps.now().toISOString();
  await deps.exchangeOwnerEmail.ensurePending({
    leadId: lead.leadId,
    cardId: card.id,
    createdAt: finalizedAt,
  });
  const newlyFinalized = await deps.exchangeOwnerEmail.tryFinalize({
    leadId: lead.leadId,
    details,
    finalizedAt,
  });
  if (!newlyFinalized) {
    return { status: "already_finalized" };
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

  const outcome = await dispatchOwnerEmailImmediate(
    sinksForDispatch,
    lead,
    details ?? EMPTY_DETAILS,
    card.id,
    card.slug,
    sourceUrl,
    leadFirstNameFromFullName(card.displayName),
    sinkDispatchDeps,
  );

  if (outcome === "failed") {
    return { status: "server_error" };
  }
  return { status: "success" };
}
