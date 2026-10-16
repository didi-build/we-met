import type { EditorCard } from "@/app-api/types";
import type { CardPublicLinksMap } from "@/card-data/types";

const LINK_KEYS = ["website", "linkedin", "github", "instagram"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertOnlyKeys(
  obj: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
): string | null {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      return `Unknown field in ${label}: ${key}`;
    }
  }
  return null;
}

function parseString(value: unknown, field: string): string | null {
  if (typeof value !== "string") {
    return `${field} must be a string`;
  }
  return null;
}

function parseLinks(raw: unknown): { links: CardPublicLinksMap } | { error: string } {
  if (!isRecord(raw)) {
    return { error: "links must be an object" };
  }
  const err = assertOnlyKeys(raw, LINK_KEYS, "links");
  if (err) {
    return { error: err };
  }
  const links: CardPublicLinksMap = {};
  for (const key of LINK_KEYS) {
    const v = raw[key];
    if (v === undefined || v === "") {
      links[key] = "";
      continue;
    }
    const typeErr = parseString(v, `links.${key}`);
    if (typeErr) {
      return { error: typeErr };
    }
    links[key] = v as string;
  }
  return { links };
}

function parseAlternate(
  raw: unknown,
): { alternate: EditorCard["alternate"] } | { error: string } {
  if (!isRecord(raw)) {
    return { error: "alternate must be an object" };
  }
  const err = assertOnlyKeys(raw, ["url", "label"], "alternate");
  if (err) {
    return { error: err };
  }
  const urlErr = parseString(raw.url, "alternate.url");
  if (urlErr) {
    return { error: urlErr };
  }
  const labelErr = parseString(raw.label, "alternate.label");
  if (labelErr) {
    return { error: labelErr };
  }
  return { alternate: { url: raw.url as string, label: raw.label as string } };
}

function parseServices(
  raw: unknown,
): { services: EditorCard["services"] } | { error: string } {
  if (!Array.isArray(raw)) {
    return { error: "services must be an array" };
  }
  const services: EditorCard["services"] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!isRecord(item)) {
      return { error: `services[${i}] must be an object` };
    }
    const err = assertOnlyKeys(item, ["title", "description"], `services[${i}]`);
    if (err) {
      return { error: err };
    }
    const titleErr = parseString(item.title, `services[${i}].title`);
    if (titleErr) {
      return { error: titleErr };
    }
    const descErr = parseString(item.description, `services[${i}].description`);
    if (descErr) {
      return { error: descErr };
    }
    services.push({
      title: item.title as string,
      description: item.description as string,
    });
  }
  return { services };
}

function parseAbout(raw: unknown): { about: string[] } | { error: string } {
  if (!Array.isArray(raw)) {
    return { error: "about must be an array" };
  }
  for (let i = 0; i < raw.length; i++) {
    const err = parseString(raw[i], `about[${i}]`);
    if (err) {
      return { error: err };
    }
  }
  return { about: raw as string[] };
}

export function parseEditorCardWire(
  raw: unknown,
): { ok: true; card: EditorCard } | { ok: false; fields: Record<string, string> } {
  if (!isRecord(raw)) {
    return { ok: false, fields: { card: "Request body must be an object" } };
  }
  const errTop = assertOnlyKeys(raw, ["card"], "body");
  if (errTop) {
    return { ok: false, fields: { body: errTop } };
  }
  const cardRaw = raw.card;
  if (!isRecord(cardRaw)) {
    return { ok: false, fields: { card: "card must be an object" } };
  }
  const cardKeys = [
    "slug",
    "name",
    "role",
    "photo",
    "about",
    "services",
    "links",
    "alternate",
  ] as const;
  const errCard = assertOnlyKeys(cardRaw, cardKeys, "card");
  if (errCard) {
    return { ok: false, fields: { card: errCard } };
  }

  const fields: Record<string, string> = {};
  const push = (key: string, message: string) => {
    fields[key] = message;
  };

  for (const key of ["slug", "name", "role", "photo"] as const) {
    const e = parseString(cardRaw[key], key);
    if (e) {
      push(key, e);
    }
  }

  const aboutResult = parseAbout(cardRaw.about);
  if ("error" in aboutResult) {
    push("about", aboutResult.error);
  }
  const servicesResult = parseServices(cardRaw.services);
  if ("error" in servicesResult) {
    push("services", servicesResult.error);
  }
  const linksResult = parseLinks(cardRaw.links);
  if ("error" in linksResult) {
    push("links", linksResult.error);
  }
  const alternateResult = parseAlternate(cardRaw.alternate);
  if ("error" in alternateResult) {
    push("alternate", alternateResult.error);
  }

  if (Object.keys(fields).length > 0) {
    return { ok: false, fields };
  }

  const card: EditorCard = {
    slug: cardRaw.slug as string,
    name: cardRaw.name as string,
    role: cardRaw.role as string,
    photo: cardRaw.photo as string,
    about: (aboutResult as { about: string[] }).about,
    services: (servicesResult as { services: EditorCard["services"] }).services,
    links: (linksResult as { links: CardPublicLinksMap }).links,
    alternate: (alternateResult as { alternate: EditorCard["alternate"] }).alternate,
  };

  return { ok: true, card };
}

export function draftJsonFromEditorCard(card: EditorCard): string {
  return JSON.stringify({
    slug: card.slug,
    name: card.name,
    role: card.role,
    about: card.about,
    services: card.services,
    links: card.links,
    alternate: card.alternate,
  });
}
