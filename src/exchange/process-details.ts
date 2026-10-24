import type { CardRecord, LeadSinkRecord } from "@/card-data/types";
import { verifyDetailsToken } from "@/exchange/token";
import type { VisitorLead, VisitorLeadDetails } from "@/exchange/types";
import type { ValidatedDetailsInput } from "@/exchange/validation";
import {
  processOwnerEmailFinalize,
  type ProcessOwnerEmailFinalizeDeps,
} from "@/exchange/process-owner-email-finalize";

export type ProcessDetailsDeps = ProcessOwnerEmailFinalizeDeps & {
  tokenSecret: string;
  environment: string;
};

export type ProcessDetailsResult =
  | { status: "success" }
  | { status: "invalid_token" }
  | { status: "card_not_found" }
  | { status: "details_already_sent" }
  | { status: "server_error" };

function leadFromToken(
  payload: {
    leadId: string;
    visitorEmail: string;
    visitorName: string;
  },
  environment: string,
  submittedAt: string,
): VisitorLead {
  const isTestLead = environment !== "production";
  return {
    leadId: payload.leadId,
    submittedAt,
    environment,
    isTestLead,
    name: payload.visitorName,
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

  if (await deps.exchangeOwnerEmail.hasFinalized(verified.payload.leadId)) {
    return { status: "details_already_sent" };
  }

  const details: VisitorLeadDetails = {
    phone: input.phone,
    jobTitle: input.jobTitle,
    company: input.company,
    note: input.note,
  };

  const lead = leadFromToken(
    verified.payload,
    deps.environment,
    new Date(verified.payload.iat * 1000).toISOString(),
  );

  const finalize = await processOwnerEmailFinalize(lead, details, card, sinks, deps);
  switch (finalize.status) {
    case "success":
      return { status: "success" };
    case "already_finalized":
      return { status: "details_already_sent" };
    case "server_error":
      return { status: "server_error" };
    default:
      return { status: "server_error" };
  }
}
