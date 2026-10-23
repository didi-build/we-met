import { VISITOR_RECEIPT_COPY } from "@/app-card/default-card-copy";

const OWNER_FIRST = "{ownerFirst}";
const VISITOR_FIRST = "{visitorFirst}";

export function substituteOwnerFirst(template: string, ownerFirst: string): string {
  return template.replaceAll(OWNER_FIRST, ownerFirst);
}

export function substituteVisitorFirst(template: string, visitorFirst: string): string {
  return template.replaceAll(VISITOR_FIRST, visitorFirst);
}

export function receiptSentToLabel(ownerFirst: string): string {
  return substituteOwnerFirst(VISITOR_RECEIPT_COPY.sentTo, ownerFirst);
}

export function receiptSaveContactLabel(ownerFirst: string): string {
  return substituteOwnerFirst(VISITOR_RECEIPT_COPY.saveContact, ownerFirst);
}

export function receiptFollowUpLine(ownerFirst: string): string {
  return substituteOwnerFirst(VISITOR_RECEIPT_COPY.followUp, ownerFirst);
}

export function receiptTellMoreLabel(ownerFirst: string): string {
  return substituteOwnerFirst(VISITOR_RECEIPT_COPY.tellMore, ownerFirst);
}

export function receiptAfterDetailsLine(visitorFirst: string): string {
  return substituteVisitorFirst(VISITOR_RECEIPT_COPY.afterDetails, visitorFirst);
}

export function receiptReloadFollowUpLine(ownerFirst: string): string {
  return substituteOwnerFirst(VISITOR_RECEIPT_COPY.reloadFollowUp, ownerFirst);
}

export function formatReceiptContactLine(email: string, phone: string): string {
  const trimmedEmail = email.trim();
  const trimmedPhone = phone.trim();
  if (trimmedEmail && trimmedPhone) {
    return `${trimmedEmail} · ${trimmedPhone}`;
  }
  return trimmedEmail || trimmedPhone;
}
