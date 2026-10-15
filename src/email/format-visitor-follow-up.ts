import type { CardEmailSnapshot } from "@/exchange/types";
import {
  cardPageUrl,
  cardUrlDisplay,
  emailLogoUrl,
  ownerPhotoUrl,
  ownerRoleFromContact,
} from "@/email/email-template-vars";
import { visitorFirstName } from "@/email/first-name";
import { sanitizeEmailHeaderValue } from "@/email/mime-headers";
import { renderEmailTemplate } from "@/email/template-renderer";
import { visitorFollowupTemplates } from "@/email/templates";

export type VisitorFollowUpEmailContent = {
  subject: string;
  textPlain: string;
  textHtml: string;
};

export type BuildVisitorFollowUpEmailInput = {
  card: CardEmailSnapshot;
  visitorName: string;
  baseUrl: string;
  /** When set, non-prod test delivery line and subject prefix. */
  nonProdVisitorEmailLabel?: string;
};

export function formatVisitorFollowUpSubject(
  visitorName: string,
  nonProdVisitorEmailLabel?: string,
): string {
  const firstName = sanitizeEmailHeaderValue(visitorFirstName(visitorName));
  const baseSubject = sanitizeEmailHeaderValue(`Great meeting you, ${firstName}`);
  if (!nonProdVisitorEmailLabel) {
    return baseSubject;
  }
  const label = sanitizeEmailHeaderValue(nonProdVisitorEmailLabel);
  return sanitizeEmailHeaderValue(`[we-met test → ${label}] ${baseSubject}`);
}

function visitorTemplateData(
  input: BuildVisitorFollowUpEmailInput,
): Record<string, string | undefined> {
  const cardUrl = cardPageUrl(input.baseUrl, input.card.slug);
  const ownerRole = ownerRoleFromContact(
    input.card.contact.title,
    input.card.contact.org,
  );
  const photo =
    input.card.photoKey !== null
      ? ownerPhotoUrl(input.baseUrl, input.card.slug)
      : undefined;

  return {
    visitor_first_name: visitorFirstName(input.visitorName),
    owner_name: input.card.contact.name.full,
    owner_role: ownerRole,
    owner_photo_url: photo,
    logo_url: emailLogoUrl(input.baseUrl),
    card_url: cardUrl,
    card_url_display: cardUrlDisplay(cardUrl),
    test_sink: input.nonProdVisitorEmailLabel,
  };
}

export function buildVisitorFollowUpEmail(
  input: BuildVisitorFollowUpEmailInput,
): VisitorFollowUpEmailContent {
  const data = visitorTemplateData(input);
  const subject = formatVisitorFollowUpSubject(
    input.visitorName,
    input.nonProdVisitorEmailLabel,
  );

  return {
    subject,
    textPlain: renderEmailTemplate(visitorFollowupTemplates.text, data, {
      html: false,
    }),
    textHtml: renderEmailTemplate(visitorFollowupTemplates.html, data, {
      html: true,
    }),
  };
}
