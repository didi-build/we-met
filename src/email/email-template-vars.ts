import { absoluteUrl } from "@/config/we-met";
import { formatReceivedAtToronto } from "@/email/format-owner-lead-email";
import { visitorFirstName } from "@/email/first-name";
import { hiPhotoPath } from "@/lib/hi-card/paths";

const EMAIL_LOGO_PATH = "/emails/wemet-mark-light-96.png";

export function emailLogoUrl(baseUrl: string): string {
  return absoluteUrl(baseUrl, EMAIL_LOGO_PATH);
}

export function cardPageUrl(baseUrl: string, slug: string): string {
  return absoluteUrl(baseUrl, `/hi/${slug}`);
}

export function cardUrlDisplay(cardUrl: string): string {
  return cardUrl.replace(/^https?:\/\//i, "");
}

export function ownerPhotoUrl(baseUrl: string, slug: string): string | undefined {
  return absoluteUrl(baseUrl, hiPhotoPath(slug));
}

export function ownerRoleFromContact(title: string, org: string): string | undefined {
  const trimmedTitle = title.trim();
  const trimmedOrg = org.trim();
  if (trimmedTitle && trimmedOrg) {
    return `${trimmedTitle} at ${trimmedOrg}`;
  }
  if (trimmedTitle) {
    return trimmedTitle;
  }
  if (trimmedOrg) {
    return trimmedOrg;
  }
  return undefined;
}

export function leadPhoneTel(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) {
    return "";
  }
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

export function formatLeadReceivedAt(iso: string): string {
  return `${formatReceivedAtToronto(iso)} (America/Toronto)`;
}

export function leadFirstNameFromFullName(name: string): string {
  return visitorFirstName(name);
}
