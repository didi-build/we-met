import type { CardRecord, LeadSinkRecord } from "@/card-data/types";
import {
  dispatchDetailsAppend,
  type LeadDeliveryDispatchLogger,
  type LeadSinkDispatchDeps,
  type LeadSinkDispatchLogger,
} from "@/exchange/lead-sink/dispatcher";
import type { LeadDeliveryLedger } from "@/lead-delivery-ledger/types";
import type { LeadSinkQueueProducer } from "@/exchange/queue/producer";
import { verifyDetailsToken } from "@/exchange/token";
import { absoluteUrl } from "@/config/we-met";
import type { LeadSinkAppendLead, VisitorLeadDetails } from "@/exchange/types";
import type { ValidatedDetailsInput } from "@/exchange/validation";

export type ProcessDetailsDeps = {
  tokenSecret: string;
  environment: string;
  leadSinkQueue: LeadSinkQueueProducer;
  deliveryLedger: LeadDeliveryLedger;
  deliveryLogger: LeadDeliveryDispatchLogger;
  leadSinkLogger: LeadSinkDispatchLogger;
  createLedgerId: () => string;
  now: () => Date;
  baseUrl: string;
};

export type ProcessDetailsResult =
  { status: "success" } | { status: "invalid_token" } | { status: "card_not_found" };

function leadFromToken(payload: {
  leadId: string;
  visitorEmail: string;
  visitorName: string;
}): LeadSinkAppendLead {
  return {
    leadId: payload.leadId,
    name: payload.visitorName,
    email: payload.visitorEmail,
  };
}

export async function processDetails(
  input: ValidatedDetailsInput,
  card: CardRecord | null,
  sinks: LeadSinkRecord[],
  deps: ProcessDetailsDeps,
): Promise<ProcessDetailsResult> {
  const verified = verifyDetailsToken(
    deps.tokenSecret,
    input.token,
    Math.floor(deps.now().getTime() / 1000),
  );
  if (!verified.ok) {
    return { status: "invalid_token" };
  }

  if (
    !card ||
    card.id !== verified.payload.cardId ||
    card.slug !== verified.payload.cardSlug
  ) {
    return { status: "card_not_found" };
  }

  const details: VisitorLeadDetails = {
    jobTitle: input.jobTitle,
    company: input.company,
    note: input.note,
  };

  const lead = leadFromToken(verified.payload);
  const sourceUrl = absoluteUrl(deps.baseUrl, `/hi/${card.slug}`);
  const detailsSubmittedAt = deps.now().toISOString();

  const sinkDispatchDeps: LeadSinkDispatchDeps = {
    producer: deps.leadSinkQueue,
    sinkLogger: deps.leadSinkLogger,
    ledger: deps.deliveryLedger,
    deliveryLogger: deps.deliveryLogger,
    now: deps.now,
    createLedgerId: deps.createLedgerId,
  };

  await dispatchDetailsAppend(
    sinks,
    lead,
    details,
    card.id,
    card.slug,
    sourceUrl,
    detailsSubmittedAt,
    sinkDispatchDeps,
  );

  return { status: "success" };
}
