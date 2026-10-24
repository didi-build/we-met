import {
  cardUrlDisplay,
  leadFirstNameFromFullName,
  leadPhoneTel,
} from "@/email/email-template-vars";
import { sanitizeEmailHeaderValue } from "@/email/mime-headers";
import { renderEmailTemplate } from "@/email/template-renderer";
import { ownerRelayTemplates } from "@/email/templates";
import type { VisitorLeadDetails } from "@/exchange/types";

export function formatOwnerRelayEmailSubject(
  visitorFullName: string,
  nonProdSinkDestinationLabel?: string,
): string {
  const safeName = sanitizeEmailHeaderValue(visitorFullName);
  const base = sanitizeEmailHeaderValue(`You met ${safeName}`);
  if (!nonProdSinkDestinationLabel) {
    return base;
  }
  return sanitizeEmailHeaderValue(
    `[we-met test → ${sanitizeEmailHeaderValue(nonProdSinkDestinationLabel)}] ${base}`,
  );
}

export type OwnerRelayEmailInput = {
  name: string;
  email: string;
  phone: string | null;
  jobTitle: string | null;
  company: string | null;
  note: string | null;
  sourceUrl: string;
  nonProdSinkDestinationLabel?: string;
};

export function ownerRelayTemplateData(
  input: OwnerRelayEmailInput,
): Record<string, string | undefined> {
  const phone = input.phone?.trim() ?? "";
  return {
    lead_name: input.name,
    lead_first_name: leadFirstNameFromFullName(input.name),
    lead_email: input.email,
    lead_phone: phone || undefined,
    lead_phone_tel: phone ? leadPhoneTel(phone) : undefined,
    job_title: input.jobTitle?.trim() || undefined,
    company: input.company?.trim() || undefined,
    note: input.note?.trim() || undefined,
    card_url: input.sourceUrl,
    card_url_display: cardUrlDisplay(input.sourceUrl),
    test_sink: input.nonProdSinkDestinationLabel,
  };
}

export function buildOwnerRelayEmail(input: OwnerRelayEmailInput): {
  subject: string;
  textPlain: string;
  textHtml: string;
} {
  const subject = formatOwnerRelayEmailSubject(
    input.name,
    input.nonProdSinkDestinationLabel,
  );
  const data = ownerRelayTemplateData(input);
  return {
    subject,
    textPlain: renderEmailTemplate(ownerRelayTemplates.text, data, { html: false }),
    textHtml: renderEmailTemplate(ownerRelayTemplates.html, data, { html: true }),
  };
}

export function ownerRelayEmailFromDetails(
  lead: { name: string; email: string },
  details: VisitorLeadDetails,
  sourceUrl: string,
  nonProdSinkDestinationLabel?: string,
): ReturnType<typeof buildOwnerRelayEmail> {
  return buildOwnerRelayEmail({
    name: lead.name,
    email: lead.email,
    phone: details.phone,
    jobTitle: details.jobTitle,
    company: details.company,
    note: details.note,
    sourceUrl,
    nonProdSinkDestinationLabel,
  });
}
