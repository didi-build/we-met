import { isPlainSingleEmailAddress } from "@/email/plain-email";
import type {
  LeadSinkAppendDetailsMessage,
  LeadSinkOwnerEmailMessage,
  LeadSinkRecordLeadMessage,
  OwnerEmailDueMessage,
} from "@/exchange/queue/types";
import type {
  CardEmailSnapshot,
  LeadSinkAppendLead,
  VisitorLead,
} from "@/exchange/types";

export { isPlainSingleEmailAddress };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseCardSnapshot(value: unknown): CardEmailSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }
  const pageCopy = isRecord(value.pageCopy) ? value.pageCopy : null;
  const contact = isRecord(value.contact) ? value.contact : null;
  const ownerFirstName =
    typeof value.ownerFirstName === "string" && value.ownerFirstName.trim().length > 0
      ? value.ownerFirstName.trim()
      : undefined;
  if (
    !isNonEmptyString(value.slug) ||
    !isNonEmptyString(value.displayName) ||
    !isNonEmptyString(value.email) ||
    !contact ||
    !pageCopy ||
    !isNonEmptyString(pageCopy.emailFromName)
  ) {
    return null;
  }
  return {
    slug: value.slug,
    displayName: value.displayName,
    email: value.email,
    ...(ownerFirstName ? { ownerFirstName } : {}),
    photoKey:
      value.photoKey === null
        ? null
        : typeof value.photoKey === "string"
          ? value.photoKey
          : null,
    contact: contact as CardEmailSnapshot["contact"],
    pageCopy: { emailFromName: pageCopy.emailFromName },
  };
}

function parseLead(value: unknown): VisitorLead | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    !isNonEmptyString(value.leadId) ||
    !isNonEmptyString(value.submittedAt) ||
    !isNonEmptyString(value.environment) ||
    typeof value.isTestLead !== "boolean" ||
    !isNonEmptyString(value.name) ||
    !isNonEmptyString(value.email) ||
    !(value.phone === null || typeof value.phone === "string") ||
    !isPlainSingleEmailAddress(value.email)
  ) {
    return null;
  }
  return value as VisitorLead;
}

export type ParsedVisitorFollowup =
  import("@/exchange/queue/types").VisitorLetterQueueMessage;

function parseRelayContactCardToken(body: Record<string, unknown>): string | undefined {
  if (typeof body.relayContactCardToken !== "string") {
    return undefined;
  }
  const trimmed = body.relayContactCardToken.trim();
  if (!trimmed || trimmed.length > 4096) {
    return undefined;
  }
  return trimmed;
}

function parseVisitorLetterPayload(
  body: Record<string, unknown>,
  type: "visitor_followup" | "visitor_letter_due",
): ParsedVisitorFollowup | null {
  const lead = parseLead(body.lead);
  const card = parseCardSnapshot(body.card);
  if (!lead || !card) {
    return null;
  }
  const relayContactCardToken = parseRelayContactCardToken(body);
  return {
    type,
    lead,
    card,
    ...(relayContactCardToken ? { relayContactCardToken } : {}),
  };
}

export function parseVisitorFollowupMessage(
  body: unknown,
): ParsedVisitorFollowup | null {
  if (!isRecord(body)) {
    return null;
  }
  if (body.type === "visitor_followup" || body.type === "visitor_letter_due") {
    return parseVisitorLetterPayload(body, body.type);
  }
  return null;
}

export function visitorLetterMessageIsFallback(parsed: ParsedVisitorFollowup): boolean {
  return parsed.type === "visitor_letter_due";
}

function parseAppendLead(value: unknown): LeadSinkAppendLead | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    !isNonEmptyString(value.leadId) ||
    !isNonEmptyString(value.name) ||
    !isNonEmptyString(value.email) ||
    !isPlainSingleEmailAddress(value.email)
  ) {
    return null;
  }
  return {
    leadId: value.leadId,
    name: value.name,
    email: value.email,
  };
}

function parseDetails(value: unknown): LeadSinkAppendDetailsMessage["details"] | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    !(value.jobTitle === null || typeof value.jobTitle === "string") ||
    !(value.company === null || typeof value.company === "string") ||
    !(value.note === null || typeof value.note === "string")
  ) {
    return null;
  }
  const phone =
    value.phone === undefined
      ? null
      : value.phone === null || typeof value.phone === "string"
        ? value.phone
        : undefined;
  if (phone === undefined) {
    return null;
  }
  return {
    phone,
    jobTitle: value.jobTitle,
    company: value.company,
    note: value.note,
  };
}

function parseLeadSinkCommon(body: Record<string, unknown>): {
  sinkId: string;
  sinkKind: string;
  sinkConfig: unknown;
  cardId: string;
  cardSlug: string;
  sourceUrl: string;
} | null {
  if (
    !isNonEmptyString(body.sinkId) ||
    !isNonEmptyString(body.sinkKind) ||
    !isRecord(body.sinkConfig) ||
    !isNonEmptyString(body.cardId) ||
    !isNonEmptyString(body.cardSlug) ||
    !isNonEmptyString(body.sourceUrl)
  ) {
    return null;
  }
  return {
    sinkId: body.sinkId,
    sinkKind: body.sinkKind,
    sinkConfig: body.sinkConfig,
    cardId: body.cardId,
    cardSlug: body.cardSlug,
    sourceUrl: body.sourceUrl,
  };
}

export function parseLeadSinkMessage(
  body: unknown,
):
  | LeadSinkRecordLeadMessage
  | LeadSinkAppendDetailsMessage
  | LeadSinkOwnerEmailMessage
  | OwnerEmailDueMessage
  | null {
  if (!isRecord(body)) {
    return null;
  }
  const common = parseLeadSinkCommon(body);
  if (!common) {
    return null;
  }

  if (body.type === "lead_sink_record") {
    const lead = parseLead(body.lead);
    if (!lead) {
      return null;
    }
    return {
      type: "lead_sink_record",
      ...common,
      lead,
    };
  }

  if (body.type === "lead_sink_append_details") {
    const lead = parseAppendLead(body.lead);
    const details = parseDetails(body.details);
    if (!lead || !details || !isNonEmptyString(body.detailsSubmittedAt)) {
      return null;
    }
    return {
      type: "lead_sink_append_details",
      ...common,
      lead,
      details,
      detailsSubmittedAt: body.detailsSubmittedAt,
    };
  }

  if (body.type === "lead_sink_owner_email" || body.type === "owner_email_due") {
    const lead = parseLead(body.lead);
    const details = parseDetails(body.details);
    if (!lead || !details) {
      return null;
    }
    const ownerFirstName =
      typeof body.ownerFirstName === "string" && body.ownerFirstName.trim().length > 0
        ? body.ownerFirstName.trim()
        : undefined;
    return {
      type: body.type,
      ...common,
      lead,
      details,
      ...(ownerFirstName ? { ownerFirstName } : {}),
    };
  }

  return null;
}

export function isLeadSinkQueueMessageType(body: unknown): boolean {
  if (!isRecord(body) || typeof body.type !== "string") {
    return false;
  }
  return (
    body.type === "lead_sink_record" ||
    body.type === "lead_sink_append_details" ||
    body.type === "lead_sink_owner_email" ||
    body.type === "owner_email_due"
  );
}

export function isUnsupportedQueueMessageType(body: unknown): boolean {
  if (!isRecord(body) || typeof body.type !== "string") {
    return true;
  }
  if (
    body.type === "visitor_followup" ||
    body.type === "visitor_letter_due" ||
    body.type === "lead_sink_record" ||
    body.type === "lead_sink_append_details" ||
    body.type === "lead_sink_owner_email" ||
    body.type === "owner_email_due"
  ) {
    return false;
  }
  return true;
}

export function queueMessageTypeLabel(body: unknown): string {
  if (!isRecord(body) || typeof body.type !== "string") {
    return "unknown";
  }
  return body.type;
}
