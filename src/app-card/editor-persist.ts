import type { EditorCard } from "@/app-api/types";
import { DEFAULT_MVP_CARD_COPY } from "@/app-card/default-card-copy";
import { emptyEditorCard } from "@/app-card/route-auth";
import { cardLoadInputToPersisted } from "@/card-data/card-persist";
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

function buildContact(draft: EditorCard): CardContact {
  const full = draft.name.trim();
  const { given, family } = splitName(full);
  const urls: CardContact["urls"] = [];
  const website = draft.links.website?.trim();
  if (website) {
    urls.push({ url: website, type: "Website" });
  }
  return {
    name: {
      full,
      given: given || full,
      family,
      nickname: given || full,
    },
    org: "",
    title: draft.role.trim(),
    phone: "",
    vcardNote: "Met via We Met",
    urls,
  };
}

function buildPageCopy(draft: EditorCard): CardPageCopy {
  const name = draft.name.trim();
  return {
    pageTitle: name ? `${name} · We Met` : "We Met",
    emailFromName: name || "We Met",
    headshotAlt: name || "Your photo",
  };
}

export function editorCardToLoadInput(
  draft: EditorCard,
  photoKey: string | null,
): CardLoadInput {
  const name = draft.name.trim();
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
    pageCopy: buildPageCopy(draft),
    contact: buildContact(draft),
    copy: DEFAULT_MVP_CARD_COPY,
    status: "live",
  };
}

export function editorCardToPersistedJson(draft: EditorCard, photoKey: string | null) {
  const input = editorCardToLoadInput(draft, photoKey);
  return cardLoadInputToPersisted(input);
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
