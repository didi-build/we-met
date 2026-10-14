import type { CardEmailSnapshot, VisitorLead } from "@/exchange/types";
import type { VisitorFollowupQueueMessage } from "@/exchange/queue/types";

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
    !(value.phone === null || typeof value.phone === "string")
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

export function isUnsupportedQueueMessageType(body: unknown): boolean {
  if (!isRecord(body) || typeof body.type !== "string") {
    return true;
  }
  if (body.type === "visitor_followup") {
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
