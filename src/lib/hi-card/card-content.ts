import type {
  CardPublicLinkType,
  CardPublicLinksMap,
  CardRecord,
  CardServiceItem,
} from "@/card-data/types";

export function cardInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  return parts
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
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

const LINK_ORDER: CardPublicLinkType[] = ["website", "linkedin", "github", "instagram"];

const LINK_LABELS: Record<CardPublicLinkType, string> = {
  website: "Website",
  linkedin: "LinkedIn",
  github: "GitHub",
  instagram: "Instagram",
};

export type CardLinkEntry = {
  type: CardPublicLinkType;
  url: string;
  label: string;
};

export function cardLinkEntries(map?: CardPublicLinksMap): CardLinkEntry[] {
  if (!map) {
    return [];
  }
  return LINK_ORDER.filter((type) => map[type]?.trim()).map((type) => ({
    type,
    url: map[type]!,
    label: LINK_LABELS[type],
  }));
}

export type CardContentFlags = {
  hasPhoto: boolean;
  hasRole: boolean;
  hasAlternate: boolean;
  hasAbout: boolean;
  hasServices: boolean;
  hasLinks: boolean;
};

export function cardContentFlags(
  card: Pick<
    CardRecord,
    "photoKey" | "role" | "alternate" | "about" | "services" | "links"
  >,
): CardContentFlags {
  const paragraphs = card.about?.paragraphs?.filter((p) => p.trim()) ?? [];
  const serviceItems = card.services?.items?.filter((s) => s.title?.trim()) ?? [];
  const linkEntries = cardLinkEntries(card.links);
  return {
    hasPhoto: Boolean(card.photoKey),
    hasRole: Boolean(card.role?.trim()),
    hasAlternate: Boolean(card.alternate?.url?.trim() && card.alternate?.label?.trim()),
    hasAbout: Boolean(card.about?.title?.trim() && paragraphs.length),
    hasServices: serviceItems.length > 0,
    hasLinks: linkEntries.length > 0,
  };
}

export function servicesForChips(services?: CardServiceItem[]): CardServiceItem[] {
  return (services ?? []).filter((s) => s.title?.trim());
}

export const WE_MET_CARD_HOME_URL = "https://we-met.link";
