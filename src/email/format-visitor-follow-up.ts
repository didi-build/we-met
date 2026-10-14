import type { CardEmailSnapshot } from "@/exchange/types";
import { escapeHtml, escapePlainTextForEmail } from "@/email/escape";
import { visitorFirstName } from "@/email/first-name";
import { sanitizeEmailHeaderValue } from "@/email/mime-headers";
export type VisitorFollowUpEmailContent = {
  subject: string;
  textPlain: string;
  textHtml: string;
};

export type BuildVisitorFollowUpEmailInput = {
  card: CardEmailSnapshot;
  visitorName: string;
  /** When set, the visitor address is shown in subject/body only (non-prod redirect). */
  nonProdVisitorEmailLabel?: string;
};

function substituteFirstName(template: string, firstName: string): string {
  const safe = escapePlainTextForEmail(firstName);
  return template.replaceAll("{firstName}", safe);
}

export function formatVisitorFollowUpSubject(
  card: CardEmailSnapshot,
  visitorName: string,
  nonProdVisitorEmailLabel?: string,
): string {
  const firstName = visitorFirstName(visitorName);
  const fromTemplate = substituteFirstName(
    card.copy.followUpEmail.subjectTemplate,
    firstName,
  );
  const baseSubject = sanitizeEmailHeaderValue(fromTemplate);
  if (!nonProdVisitorEmailLabel) {
    return baseSubject;
  }
  const label = sanitizeEmailHeaderValue(nonProdVisitorEmailLabel);
  return sanitizeEmailHeaderValue(`[we-met test → ${label}] ${baseSubject}`);
}

export function buildVisitorFollowUpEmail(
  input: BuildVisitorFollowUpEmailInput,
): VisitorFollowUpEmailContent {
  const copy = input.card.copy.followUpEmail;
  const firstName = visitorFirstName(input.visitorName);
  const greetingPlain = substituteFirstName(copy.greetingTemplate, firstName);
  const greetingHtml = escapeHtml(
    substituteFirstName(copy.greetingTemplate, firstName),
  );
  const paragraphsPlain = copy.bodyParagraphs.map((p) => escapePlainTextForEmail(p));
  const paragraphsHtml = copy.bodyParagraphs.map((p) => escapeHtml(p)).join("<br><br>");
  const attachmentPlain = escapePlainTextForEmail(copy.attachmentLine);
  const attachmentHtml = escapeHtml(copy.attachmentLine);
  const closingPlain = escapePlainTextForEmail(copy.closingLine);
  const closingHtml = escapeHtml(copy.closingLine);
  const bookLabelPlain = escapePlainTextForEmail(copy.bookCtaLabel);
  const bookLabelHtml = escapeHtml(copy.bookCtaLabel);
  const bookingUrl = input.card.links.bookingUrl;
  const ownerName = escapePlainTextForEmail(input.card.contact.name.full);
  const ownerNameHtml = escapeHtml(input.card.contact.name.full);

  const nonProdLines: string[] = [];
  if (input.nonProdVisitorEmailLabel) {
    const label = escapePlainTextForEmail(input.nonProdVisitorEmailLabel);
    nonProdLines.push(`Test delivery (visitor typed): ${label}`, "");
  }

  const signOffPlain = [ownerName, closingPlain].filter(Boolean).join("\n");
  const signOffHtml = `<p>${ownerNameHtml}<br>${closingHtml}</p>`;

  const textPlain = [
    greetingPlain,
    "",
    ...nonProdLines,
    ...paragraphsPlain,
    "",
    attachmentPlain,
    "",
    `${bookLabelPlain}: ${bookingUrl}`,
    "",
    signOffPlain,
  ].join("\n");

  const textHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body>
  <p><strong>${greetingHtml}</strong></p>
  ${
    input.nonProdVisitorEmailLabel
      ? `<p><em>Test delivery (visitor typed): ${escapeHtml(
          escapePlainTextForEmail(input.nonProdVisitorEmailLabel),
        )}</em></p>`
      : ""
  }
  <p>${paragraphsHtml}</p>
  <p>${attachmentHtml}</p>
  <p><a href="${escapeHtml(bookingUrl)}">${bookLabelHtml}</a></p>
  ${signOffHtml}
</body>
</html>`;

  const subject = formatVisitorFollowUpSubject(
    input.card,
    input.visitorName,
    input.nonProdVisitorEmailLabel,
  );

  return { subject, textPlain, textHtml };
}
