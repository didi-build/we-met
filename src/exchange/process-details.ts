import type { CardRecord, LeadSinkRecord } from "@/card-data/types";
import {
  dispatchDetailsAppend,
  type LeadSinkDispatchLogger,
} from "@/exchange/lead-sink/dispatcher";
import type { LeadSinkQueueProducer } from "@/exchange/queue/producer";
import { verifyDetailsToken } from "@/exchange/token";
import type { VisitorLead, VisitorLeadDetails } from "@/exchange/types";
import type { ValidatedDetailsInput } from "@/exchange/validation";

export type ProcessDetailsDeps = {
  tokenSecret: string;
  environment: string;
  leadSinkQueue: LeadSinkQueueProducer;
  leadSinkLogger: LeadSinkDispatchLogger;
  now: () => Date;
};

export type ProcessDetailsResult =
  { status: "success" } | { status: "invalid_token" } | { status: "card_not_found" };

function leadFromToken(
  payload: { leadId: string; visitorEmail: string },
  environment: string,
  now: Date,
): VisitorLead {
  return {
    leadId: payload.leadId,
    submittedAt: now.toISOString(),
    environment,
    isTestLead: environment !== "production",
    name: "",
    email: payload.visitorEmail,
    phone: null,
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

  const lead = leadFromToken(verified.payload, deps.environment, deps.now());

  await dispatchDetailsAppend(
    sinks,
    lead,
    details,
    card.id,
    card.slug,
    deps.leadSinkQueue,
    deps.leadSinkLogger,
  );

  return { status: "success" };
}
