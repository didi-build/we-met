import type {
  CardPublicLink,
  CardPublicLinkType,
  CardRecord,
  CardService,
} from "@/card-data/types";

export function cardInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function cardGreeting(name: string): string {
  const trimmed = name.trim();
  const first = trimmed.split(/\s+/)[0] ?? "";
  return first ? `I'm ${first}` : trimmed;
}

export function firstNameFromFullName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "there";
  }
  return trimmed.split(/\s+/)[0] ?? "there";
}

/** Public link types shown as icon buttons (matches design/Contact-Card.dc.html). */
const HI_ICON_LINK_TYPES = new Set<CardPublicLinkType>([
  "website",
  "linkedin",
  "github",
  "instagram",
]);

export type CardContentFlags = {
  hasPhoto: boolean;
  hasRole: boolean;
  hasFallback: boolean;
  hasAbout: boolean;
  hasServices: boolean;
  hasLinks: boolean;
  hasSocialLinks: boolean;
};

export function cardContentFlags(card: CardRecord): CardContentFlags {
  const services = card.services?.filter((s) => s.label?.trim()) ?? [];
  const publicLinks = card.publicLinks?.filter((l) => l.url?.trim()) ?? [];
  const social = publicLinks.filter((l) => HI_ICON_LINK_TYPES.has(l.type));
  return {
    hasPhoto: Boolean(card.photoKey),
    hasRole: Boolean(card.role?.trim()),
    hasFallback: Boolean(card.fallbackUrl?.trim() && card.fallbackLabel?.trim()),
    hasAbout: Boolean(card.aboutTitle?.trim() && card.about?.some((p) => p.trim())),
    hasServices: services.length > 0,
    hasLinks: publicLinks.length > 0,
    hasSocialLinks: social.length > 0,
  };
}

export function servicesForChips(services?: CardService[]): CardService[] {
  return (services ?? []).filter((s) => s.label?.trim());
}

export function websiteLinks(links?: CardPublicLink[]): CardPublicLink[] {
  return (links ?? []).filter((l) => l.type === "website" && l.url?.trim());
}

export function socialLinks(links?: CardPublicLink[]): CardPublicLink[] {
  return (links ?? []).filter((l) => l.url?.trim() && HI_ICON_LINK_TYPES.has(l.type));
}

export const WE_MET_CARD_HOME_URL = "https://we-met.link";
