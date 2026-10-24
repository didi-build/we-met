import type { CardRecord, LeadSinkRecord } from "@/card-data/types";
import { verifyDetailsToken } from "@/exchange/token";
import type { VisitorLead } from "@/exchange/types";
import type { ValidatedDetailsDismissInput } from "@/exchange/validation";
import {
  processOwnerEmailFinalize,
  type ProcessOwnerEmailFinalizeDeps,
} from "@/exchange/process-owner-email-finalize";

export type ProcessDetailsDismissDeps = ProcessOwnerEmailFinalizeDeps & {
  tokenSecret: string;
  environment: string;
};

export type ProcessDetailsDismissResult =
  | { status: "success" }
  | { status: "invalid_token" }
  | { status: "card_not_found" }
  | { status: "already_finalized" };

function leadFromToken(
  payload: {
    leadId: string;
    visitorEmail: string;
    visitorName: string;
    iat: number;
  },
  environment: string,
): VisitorLead {
  const isTestLead = environment !== "production";
  return {
    leadId: payload.leadId,
    submittedAt: new Date(payload.iat * 1000).toISOString(),
    environment,
    isTestLead,
    name: payload.visitorName,
    email: payload.visitorEmail,
    phone: null,
  };
}

export async function processDetailsDismiss(
  input: ValidatedDetailsDismissInput,
  card: CardRecord | null,
  sinks: LeadSinkRecord[],
  deps: ProcessDetailsDismissDeps,
): Promise<ProcessDetailsDismissResult> {
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

  if (await deps.exchangeOwnerEmail.hasTriggered(verified.payload.leadId)) {
    return { status: "already_finalized" };
  }

  const lead = leadFromToken(verified.payload, deps.environment);
  const finalize = await processOwnerEmailFinalize(lead, null, card, sinks, deps);
  switch (finalize.status) {
    case "success":
      return { status: "success" };
    case "already_finalized":
      return { status: "already_finalized" };
  }
}
