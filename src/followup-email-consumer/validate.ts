import { isPlainSingleEmailAddress } from "@/email/plain-email";
import type {
  LeadSinkAppendDetailsMessage,
  LeadSinkRecordLeadMessage,
} from "@/exchange/queue/types";
import type {
  CardEmailSnapshot,
  LeadSinkAppendLead,
  VisitorLead,
} from "@/exchange/types";
import type { VisitorFollowupQueueMessage } from "@/exchange/queue/types";

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
  const copy = value.copy;
  const followUpEmail =
    isRecord(copy) && isRecord(copy.followUpEmail) ? copy.followUpEmail : null;
  const pageCopy = isRecord(value.pageCopy) ? value.pageCopy : null;
  const links = isRecord(value.links) ? value.links : null;
  const contact = isRecord(value.contact) ? value.contact : null;
  if (
    !isNonEmptyString(value.slug) ||
    !isNonEmptyString(value.displayName) ||
    !isNonEmptyString(value.email) ||
    !contact ||
    !links ||
    !isNonEmptyString(links.bookingUrl) ||
    !pageCopy ||
    !isNonEmptyString(pageCopy.emailFromName) ||
    !followUpEmail ||
    !isNonEmptyString(followUpEmail.subjectTemplate) ||
    !isNonEmptyString(followUpEmail.greetingTemplate) ||
    !Array.isArray(followUpEmail.bodyParagraphs) ||
    !isNonEmptyString(followUpEmail.attachmentLine) ||
    !isNonEmptyString(followUpEmail.bookCtaLabel) ||
    !isNonEmptyString(followUpEmail.closingLine)
  ) {
    return null;
  }
  return value as CardEmailSnapshot;
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

export type ParsedVisitorFollowup = VisitorFollowupQueueMessage;

export function parseVisitorFollowupMessage(
  body: unknown,
): ParsedVisitorFollowup | null {
  if (!isRecord(body) || body.type !== "visitor_followup") {
    return null;
  }
  const lead = parseLead(body.lead);
  const card = parseCardSnapshot(body.card);
  if (!lead || !card) {
    return null;
  }
  return { type: "visitor_followup", lead, card };
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
  return {
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
): LeadSinkRecordLeadMessage | LeadSinkAppendDetailsMessage | null {
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

  return null;
}

export function isLeadSinkQueueMessageType(body: unknown): boolean {
  if (!isRecord(body) || typeof body.type !== "string") {
    return false;
  }
  return body.type === "lead_sink_record" || body.type === "lead_sink_append_details";
}

export function isUnsupportedQueueMessageType(body: unknown): boolean {
  if (!isRecord(body) || typeof body.type !== "string") {
    return true;
  }
  if (
    body.type === "visitor_followup" ||
    body.type === "lead_sink_record" ||
    body.type === "lead_sink_append_details"
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
