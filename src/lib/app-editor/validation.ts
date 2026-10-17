import { CARD_FIELD_LIMITS } from "@/card-data/limits";
import type { EditorCard } from "@/app-api/types";
import { phoneValidationMessage } from "@/app-card/validate-editor-card";
import type { SlugUiStatus } from "@/lib/app-editor/slug";

export function isHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && u.hostname.includes(".");
  } catch {
    return false;
  }
}

export function maxForField(key: string): number {
  if (key === "name") {
    return CARD_FIELD_LIMITS.name;
  }
  if (key === "role") {
    return CARD_FIELD_LIMITS.role;
  }
  if (key === "phone") {
    return CARD_FIELD_LIMITS.phone;
  }
  if (key === "alternate.label") {
    return CARD_FIELD_LIMITS.alternateLabel;
  }
  if (/^about\.\d+$/.test(key)) {
    return CARD_FIELD_LIMITS.aboutParagraph;
  }
  if (/\.title$/.test(key)) {
    return CARD_FIELD_LIMITS.serviceLabel;
  }
  if (/\.description$/.test(key)) {
    return CARD_FIELD_LIMITS.serviceDescription;
  }
  return 0;
}

export function fieldError(
  key: string,
  card: EditorCard,
  slugStatus: SlugUiStatus,
  triedPublish: boolean,
): string {
  const get = (path: string): string => {
    const parts = path.split(".");
    let cur: unknown = card;
    for (const p of parts) {
      if (cur == null || typeof cur !== "object") {
        return "";
      }
      cur = (cur as Record<string, unknown>)[p];
    }
    return String(cur ?? "");
  };

  const v = get(key);
  const t = v.trim();
  const max = maxForField(key);

  if (key === "slug") {
    if (slugStatus.status === "invalid") {
      return slugStatus.message ?? "";
    }
    if (slugStatus.status === "reserved") {
      return "That name is reserved. Try another.";
    }
    if (slugStatus.status === "taken") {
      return "That link is taken. Try another.";
    }
    if (triedPublish && !t) {
      return "Choose your link to publish.";
    }
    return "";
  }

  if (key === "phone") {
    return phoneValidationMessage(v) ?? "";
  }

  if (max && v.length > max) {
    if (key === "name") {
      return `Keep your name to ${max} characters or fewer.`;
    }
    if (/^about/.test(key)) {
      return `Keep each paragraph to ${max} characters or fewer.`;
    }
    return `Keep this to ${max} characters or fewer.`;
  }

  if (/\.title$/.test(key)) {
    const i = Number(key.split(".")[1]);
    const desc = card.services[i]?.description?.trim();
    if (!t && desc) {
      return "Add a title for this service.";
    }
  }

  if (/^links\./.test(key) || key === "alternate.url") {
    if (t && !isHttpsUrl(t)) {
      return "Use a full link that starts with https://";
    }
  }

  if (key === "alternate.url" && !t && card.alternate.label.trim()) {
    return "Add the link this text should open.";
  }

  return "";
}

export function allFieldKeys(card: EditorCard): string[] {
  const keys = [
    "slug",
    "name",
    "role",
    "phone",
    "links.website",
    "links.linkedin",
    "links.github",
    "links.instagram",
    "alternate.url",
    "alternate.label",
  ];
  card.about.forEach((_, i) => keys.push(`about.${i}`));
  card.services.forEach((_, i) => {
    keys.push(`services.${i}.title`, `services.${i}.description`);
  });
  return keys;
}
