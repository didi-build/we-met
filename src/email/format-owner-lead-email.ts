import { escapeHtml, escapePlainTextForEmail } from "@/email/escape";
import { sanitizeEmailHeaderValue } from "@/email/mime-headers";

export const WE_MET_OWNER_EMAIL_DISPLAY_NAME = "We Met";

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

/** Record and append subjects share non-prod prefix logic for Gmail threading. */
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
  jobTitle: string | null;
  company: string | null;
  note: string | null;
  sourceUrl: string;
  detailsSubmittedAtIso: string;
  nonProdSinkDestinationLabel?: string;
};

function nonProdBodyLines(sinkDestinationLabel: string): string[] {
  const label = escapePlainTextForEmail(sinkDestinationLabel);
  return [`Test delivery (sink destination): ${label}`, ""];
}

function sourcePlain(sourceUrl: string): string {
  return `Source: Business card, ${escapePlainTextForEmail(sourceUrl)}`;
}

function sourceHtml(sourceUrl: string): string {
  const url = escapeHtml(sourceUrl);
  return `<p><strong>Source:</strong> Business card, <a href="${url}">${url}</a></p>`;
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
  const namePlain = escapePlainTextForEmail(input.name);
  const emailPlain = escapePlainTextForEmail(input.email);
  const phonePlain = escapePlainTextForEmail(input.phone?.trim() ? input.phone : "—");
  const receivedPlain = escapePlainTextForEmail(
    formatReceivedAtToronto(input.receivedAtIso),
  );

  const nonProdPlain = input.nonProdSinkDestinationLabel
    ? nonProdBodyLines(input.nonProdSinkDestinationLabel)
    : [];

  const textPlain = [
    ...nonProdPlain,
    `Name: ${namePlain}`,
    `Email: ${emailPlain}`,
    `Phone: ${phonePlain}`,
    sourcePlain(input.sourceUrl),
    `Received: ${receivedPlain} (America/Toronto)`,
  ].join("\n");

  const nameHtml = escapeHtml(input.name);
  const emailHtml = escapeHtml(input.email);
  const phoneHtml = escapeHtml(input.phone?.trim() ? input.phone : "—");
  const receivedHtml = escapeHtml(formatReceivedAtToronto(input.receivedAtIso));

  const nonProdHtml = input.nonProdSinkDestinationLabel
    ? `<p>Test delivery (sink destination): ${escapeHtml(input.nonProdSinkDestinationLabel)}</p>`
    : "";

  const textHtml = [
    nonProdHtml,
    `<p><strong>Name:</strong> ${nameHtml}</p>`,
    `<p><strong>Email:</strong> <a href="mailto:${emailHtml}">${emailHtml}</a></p>`,
    `<p><strong>Phone:</strong> ${phoneHtml}</p>`,
    sourceHtml(input.sourceUrl),
    `<p><strong>Received:</strong> ${receivedHtml} (America/Toronto)</p>`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject: subjects.record, textPlain, textHtml };
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

  const lines: string[] = [];
  if (input.nonProdSinkDestinationLabel) {
    lines.push(...nonProdBodyLines(input.nonProdSinkDestinationLabel));
  }
  lines.push(`Lead: ${escapePlainTextForEmail(input.name)}`);
  lines.push(`Email: ${escapePlainTextForEmail(input.email)}`);
  if (input.jobTitle?.trim()) {
    lines.push(`Job title: ${escapePlainTextForEmail(input.jobTitle.trim())}`);
  }
  if (input.company?.trim()) {
    lines.push(`Company: ${escapePlainTextForEmail(input.company.trim())}`);
  }
  if (input.note?.trim()) {
    lines.push(`Note: ${escapePlainTextForEmail(input.note.trim())}`);
  }
  lines.push(sourcePlain(input.sourceUrl));
  const submittedPlain = escapePlainTextForEmail(
    formatReceivedAtToronto(input.detailsSubmittedAtIso),
  );
  lines.push(`Submitted: ${submittedPlain} (America/Toronto)`);

  const parts: string[] = [];
  if (input.nonProdSinkDestinationLabel) {
    parts.push(
      `<p>Test delivery (sink destination): ${escapeHtml(input.nonProdSinkDestinationLabel)}</p>`,
    );
  }
  parts.push(`<p><strong>Lead:</strong> ${escapeHtml(input.name)}</p>`);
  parts.push(
    `<p><strong>Email:</strong> <a href="mailto:${escapeHtml(input.email)}">${escapeHtml(input.email)}</a></p>`,
  );
  if (input.jobTitle?.trim()) {
    parts.push(
      `<p><strong>Job title:</strong> ${escapeHtml(input.jobTitle.trim())}</p>`,
    );
  }
  if (input.company?.trim()) {
    parts.push(`<p><strong>Company:</strong> ${escapeHtml(input.company.trim())}</p>`);
  }
  if (input.note?.trim()) {
    parts.push(`<p><strong>Note:</strong> ${escapeHtml(input.note.trim())}</p>`);
  }
  parts.push(sourceHtml(input.sourceUrl));
  parts.push(
    `<p><strong>Submitted:</strong> ${escapeHtml(formatReceivedAtToronto(input.detailsSubmittedAtIso))} (America/Toronto)</p>`,
  );

  return {
    subject: subjects.append,
    textPlain: lines.join("\n"),
    textHtml: parts.join("\n"),
  };
}

export function ownerLeadMessageIdDomain(ownerFromEmail: string): string {
  const at = ownerFromEmail.indexOf("@");
  if (at <= 0) {
    return ownerFromEmail;
  }
  return ownerFromEmail.slice(at + 1);
}

export function buildOwnerLeadRecordMessageId(
  leadId: string,
  sinkId: string,
  ownerFromEmail: string,
): string {
  const domain = ownerLeadMessageIdDomain(ownerFromEmail);
  return `<${leadId}.${sinkId}.record@${domain}>`;
}

export function buildOwnerLeadAppendMessageId(
  leadId: string,
  sinkId: string,
  ownerFromEmail: string,
): string {
  const domain = ownerLeadMessageIdDomain(ownerFromEmail);
  return `<${leadId}.${sinkId}.append@${domain}>`;
}
