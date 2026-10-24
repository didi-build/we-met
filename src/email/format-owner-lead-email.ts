import {
  cardUrlDisplay,
  formatLeadReceivedAt,
  leadFirstNameFromFullName,
  leadPhoneTel,
} from "@/email/email-template-vars";
import { sanitizeEmailHeaderValue } from "@/email/mime-headers";
import { renderEmailTemplate } from "@/email/template-renderer";
import { ownerDetailsUpdateTemplates, ownerNewLeadTemplates } from "@/email/templates";

export function formatReceivedAtToronto(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function baseLeadSubjectName(visitorName: string): string {
  const safeName = sanitizeEmailHeaderValue(visitorName);
  return sanitizeEmailHeaderValue(`New lead added: ${safeName}`);
}

/** Record and append subjects share non-prod prefix logic for mailbox threading. */
export function formatOwnerLeadEmailSubjects(
  visitorName: string,
  nonProdSinkDestinationLabel?: string,
): { record: string; append: string } {
  const base = baseLeadSubjectName(visitorName);
  const prefixed = nonProdSinkDestinationLabel
    ? sanitizeEmailHeaderValue(
        `[we-met test → ${sanitizeEmailHeaderValue(nonProdSinkDestinationLabel)}] ${base}`,
      )
    : base;
  return {
    record: prefixed,
    append: sanitizeEmailHeaderValue(`Re: ${prefixed}`),
  };
}

export type OwnerLeadRecordEmailInput = {
  name: string;
  email: string;
  phone: string | null;
  sourceUrl: string;
  receivedAtIso: string;
  nonProdSinkDestinationLabel?: string;
};

export type OwnerLeadAppendEmailInput = {
  name: string;
  email: string;
  phone: string | null;
  jobTitle: string | null;
  company: string | null;
  note: string | null;
  nonProdSinkDestinationLabel?: string;
};

function recordTemplateData(
  input: OwnerLeadRecordEmailInput,
): Record<string, string | undefined> {
  const phone = input.phone?.trim() ?? "";
  return {
    lead_name: input.name,
    lead_email: input.email,
    lead_phone: phone || undefined,
    lead_phone_tel: phone ? leadPhoneTel(phone) : undefined,
    card_url: input.sourceUrl,
    card_url_display: cardUrlDisplay(input.sourceUrl),
    received_at: formatLeadReceivedAt(input.receivedAtIso),
    test_sink: input.nonProdSinkDestinationLabel,
  };
}

function appendTemplateData(
  input: OwnerLeadAppendEmailInput,
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
    test_sink: input.nonProdSinkDestinationLabel,
  };
}

export function buildOwnerLeadRecordEmail(input: OwnerLeadRecordEmailInput): {
  subject: string;
  textPlain: string;
  textHtml: string;
} {
  const subjects = formatOwnerLeadEmailSubjects(
    input.name,
    input.nonProdSinkDestinationLabel,
  );
  const data = recordTemplateData(input);
  return {
    subject: subjects.record,
    textPlain: renderEmailTemplate(ownerNewLeadTemplates.text, data, {
      html: false,
    }),
    textHtml: renderEmailTemplate(ownerNewLeadTemplates.html, data, {
      html: true,
    }),
  };
}

export function buildOwnerLeadAppendEmail(input: OwnerLeadAppendEmailInput): {
  subject: string;
  textPlain: string;
  textHtml: string;
} {
  const subjects = formatOwnerLeadEmailSubjects(
    input.name,
    input.nonProdSinkDestinationLabel,
  );
  const data = appendTemplateData(input);
  return {
    subject: subjects.append,
    textPlain: renderEmailTemplate(ownerDetailsUpdateTemplates.text, data, {
      html: false,
    }),
    textHtml: renderEmailTemplate(ownerDetailsUpdateTemplates.html, data, {
      html: true,
    }),
  };
}
