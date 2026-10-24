import { resolveLeadSinksForDispatch } from "@/card-data/account-email";
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
import { utcDayFromDate } from "@/lead-email/daily-send-counts";

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
  assertLeadEmailCapacity: (cardId: string, needed: number) => Promise<boolean>;
};

export type ProcessDetailsResult =
  | { status: "success" }
  | { status: "invalid_token" }
  | { status: "card_not_found" }
  | { status: "lead_email_unavailable" }
  | { status: "details_already_sent" }
  | { status: "server_error" };

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

  const lead = leadFromToken(verified.payload);

  if (await deps.deliveryLedger.hasAppendPhaseForLead(lead.leadId)) {
    return { status: "details_already_sent" };
  }

  if (!(await deps.assertLeadEmailCapacity(card.id, 1))) {
    return { status: "lead_email_unavailable" };
  }

  const details: VisitorLeadDetails = {
    phone: input.phone,
    jobTitle: input.jobTitle,
    company: input.company,
    note: input.note,
  };

  const sourceUrl = absoluteUrl(deps.baseUrl, `/hi/${card.slug}`);
  const detailsSubmittedAt = deps.now().toISOString();
  const sinksForDispatch = resolveLeadSinksForDispatch(sinks, card.email);
  const enabledSinks = sinksForDispatch.filter((s) => s.enabled);

  const day = utcDayFromDate(deps.now());
  const sinkDispatchDeps: LeadSinkDispatchDeps = {
    producer: deps.leadSinkQueue,
    sinkLogger: deps.leadSinkLogger,
    ledger: deps.deliveryLedger,
    deliveryLogger: deps.deliveryLogger,
    now: deps.now,
    createLedgerId: deps.createLedgerId,
    dailySendOnFirstLedger: { day, cardId: card.id, kinds: ["owner"] },
  };

  const appendOutcome = await dispatchDetailsAppend(
    sinksForDispatch,
    lead,
    details,
    card.id,
    card.slug,
    sourceUrl,
    detailsSubmittedAt,
    sinkDispatchDeps,
  );

  if (appendOutcome === "failed") {
    return { status: "server_error" };
  }
  if (enabledSinks.length > 0 && appendOutcome === "already_exists") {
    return { status: "details_already_sent" };
  }

  return { status: "success" };
}
