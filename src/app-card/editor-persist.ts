import type { EditorCard } from "@/app-api/types";
import { DEFAULT_MVP_CARD_COPY } from "@/app-card/default-card-copy";
import { emptyEditorCard } from "@/app-card/route-auth";
import { cardLoadInputToPersisted } from "@/card-data/card-persist";
import { containsVCardControlChars } from "@/lib/hi/vcard";
import type {
  CardAbout,
  CardContact,
  CardLoadInput,
  CardPageCopy,
  CardPublicLinksMap,
  CardServices,
} from "@/card-data/types";

function splitName(full: string): { given: string; family: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return { given: "", family: "" };
  }
  if (parts.length === 1) {
    return { given: parts[0], family: "" };
  }
  return { given: parts[0], family: parts.slice(1).join(" ") };
}

function buildAbout(draft: EditorCard): CardAbout | undefined {
  const paragraphs = draft.about.map((p) => p.trim()).filter(Boolean);
  if (!paragraphs.length) {
    return undefined;
  }
  return { title: "About me", paragraphs };
}

function buildServices(draft: EditorCard): CardServices | undefined {
  const items = draft.services
    .filter((s) => s.title.trim())
    .map((s) => ({ title: s.title.trim(), description: s.description.trim() }));
  if (!items.length) {
    return undefined;
  }
  return { title: "What I do", items };
}

function buildLinks(draft: EditorCard): CardPublicLinksMap {
  const links: CardPublicLinksMap = {};
  for (const key of ["website", "linkedin", "github", "instagram"] as const) {
    const value = draft.links[key]?.trim();
    if (value) {
      links[key] = value;
    }
  }
  return links;
}

function resolveDisplayName(draft: EditorCard, accountName: string): string {
  const typed = draft.name.trim();
  const google = accountName.trim();
  return typed || google;
}

function contactNickname(displayName: string, googleFullName: string): string {
  const display = displayName.trim();
  const google = googleFullName.trim();
  if (!display || display.toLowerCase() === google.toLowerCase()) {
    return "";
  }
  return display;
}

function pushContactUrl(
  urls: CardContact["urls"],
  raw: string | undefined,
  type: string,
): void {
  const url = raw?.trim();
  if (!url || containsVCardControlChars(url)) {
    return;
  }
  urls.push({ url, type });
}

function buildContact(draft: EditorCard, accountName: string): CardContact {
  const googleFull = accountName.trim();
  const { given, family } = splitName(googleFull);
  const displayName = resolveDisplayName(draft, accountName);
  const urls: CardContact["urls"] = [];
  pushContactUrl(urls, draft.links.website, "Website");
  pushContactUrl(urls, draft.links.linkedin, "LinkedIn");
  pushContactUrl(urls, draft.links.github, "GitHub");
  pushContactUrl(urls, draft.links.instagram, "Instagram");

  const phoneRaw = draft.phone?.trim() ?? "";
  const phone = phoneRaw && !containsVCardControlChars(phoneRaw) ? phoneRaw : "";

  return {
    name: {
      full: googleFull,
      given: given || googleFull,
      family,
      nickname: contactNickname(displayName, googleFull),
    },
    org: "",
    title: draft.role.trim(),
    phone,
    vcardNote: "Met via We Met",
    urls,
  };
}

function buildPageCopy(draft: EditorCard, accountName: string): CardPageCopy {
  const name = resolveDisplayName(draft, accountName);
  return {
    pageTitle: `${name} · We Met`,
    emailFromName: name,
    headshotAlt: name,
  };
}

export function editorCardToLoadInput(
  draft: EditorCard,
  photoKey: string | null,
  accountName: string,
): CardLoadInput {
  const name = resolveDisplayName(draft, accountName);
  const alternate =
    draft.alternate.url.trim() && draft.alternate.label.trim()
      ? { url: draft.alternate.url.trim(), label: draft.alternate.label.trim() }
      : undefined;

  return {
    slug: draft.slug.trim(),
    variant: "mono",
    displayName: name,
    email: "",
    photoKey,
    name,
    role: draft.role.trim() || undefined,
    about: buildAbout(draft),
    services: buildServices(draft),
    links: buildLinks(draft),
    alternate,
    bookingLinks: { bookingUrl: alternate?.url ?? "" },
    pageCopy: buildPageCopy(draft, accountName),
    contact: buildContact(draft, accountName),
    copy: DEFAULT_MVP_CARD_COPY,
    status: "live",
  };
}

export function editorCardToPersistedJson(
  draft: EditorCard,
  photoKey: string | null,
  accountName: string,
) {
  const input = editorCardToLoadInput(draft, photoKey, accountName);
  return {
    ...cardLoadInputToPersisted(input),
    displayName: input.displayName,
  };
}

export function draftPhotoUrl(key: string | null): string {
  if (!key) {
    return "";
  }
  return `/api/app/photo?v=${encodeURIComponent(key)}`;
}

export function publishedRowToEditorCard(
  row: {
    slug: string;
    photo_key: string | null;
    page_copy_json: string;
    links_json: string;
  },
  parseJson: <T>(raw: string) => T,
): EditorCard {
  const page = parseJson<{
    name?: string;
    role?: string;
    about?: CardAbout;
    services?: CardServices;
    links?: CardPublicLinksMap;
    alternate?: { url: string; label: string };
  }>(row.page_copy_json);
  const linksStored = parseJson<{ bookingUrl?: string }>(row.links_json);

  const about = page.about?.paragraphs ?? [];
  const services =
    page.services?.items.map((s) => ({
      title: s.title,
      description: s.description,
    })) ?? [];

  return {
    slug: row.slug,
    name: page.name ?? "",
    role: page.role ?? "",
    photo: draftPhotoUrl(row.photo_key),
    about: [...about],
    services,
    links: {
      website: page.links?.website ?? "",
      linkedin: page.links?.linkedin ?? "",
      github: page.links?.github ?? "",
      instagram: page.links?.instagram ?? "",
    },
    alternate: page.alternate ?? {
      url: linksStored.bookingUrl ?? "",
      label: "",
    },
  };
}

export function draftJsonToEditorCard(
  draftJson: string,
  photoKey: string | null,
): EditorCard {
  const defaults = emptyEditorCard();
  let parsed: Partial<EditorCard> = {};
  try {
    const raw = JSON.parse(draftJson) as unknown;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      parsed = raw as Partial<EditorCard>;
    }
  } catch {
    parsed = {};
  }
  const merged: EditorCard = {
    ...defaults,
    ...parsed,
    about: Array.isArray(parsed.about) ? parsed.about : defaults.about,
    services: Array.isArray(parsed.services) ? parsed.services : defaults.services,
    links: {
      ...defaults.links,
      ...(parsed.links && typeof parsed.links === "object" ? parsed.links : {}),
    },
    alternate: {
      ...defaults.alternate,
      ...(parsed.alternate && typeof parsed.alternate === "object"
        ? parsed.alternate
        : {}),
    },
    photo: photoKey ? draftPhotoUrl(photoKey) : "",
  };
  return merged;
}
