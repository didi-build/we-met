import type { EditorCard } from "@/app-api/types";
import { CARD_FIELD_LIMITS } from "@/card-data/limits";
import { isReservedSlug } from "@/card-data/reserved-slugs";
import { isValidSlug } from "@/card-data/slug";
import { isHttpsUrl } from "@/lib/app-editor/validation";
import { slugFormatCheck } from "@/lib/app-editor/slug";

export type EditorValidationResult =
  | { ok: true }
  | { ok: false; code: "name-missing" }
  | { ok: false; code: "slug-invalid" }
  | { ok: false; code: "slug-reserved" }
  | { ok: false; code: "invalid-fields"; fields: Record<string, string> };

/** Returns a user-facing error message, or null when the value is valid (empty is allowed). */
export function phoneValidationMessage(phone: string): string | null {
  if (!phone.trim()) {
    return null;
  }
  if (/[\u0000-\u001f\u007f]/.test(phone)) {
    return "Use a valid phone number.";
  }
  const value = phone.trim();
  if (value.length > CARD_FIELD_LIMITS.phone) {
    return `Keep your phone to ${CARD_FIELD_LIMITS.phone} characters or fewer.`;
  }
  if (!/^[\d\s+\-().]+$/.test(value)) {
    return "Use only digits, spaces, and + - ( ) .";
  }
  const digits = value.replace(/\D/g, "").length;
  if (digits < 7) {
    return "Add at least 7 digits.";
  }
  return null;
}

function fieldLimitMessage(key: string, max: number): string {
  if (key === "name") {
    return `Keep your name to ${max} characters or fewer.`;
  }
  if (key.startsWith("about.")) {
    return `Keep each paragraph to ${max} characters or fewer.`;
  }
  return `Keep this to ${max} characters or fewer.`;
}

/** Hard size and count limits only (draft saves allow incomplete slug/URLs). */
function collectDraftLimitViolations(card: EditorCard): Record<string, string> {
  const fields: Record<string, string> = {};

  if (card.name.length > CARD_FIELD_LIMITS.name) {
    fields.name = fieldLimitMessage("name", CARD_FIELD_LIMITS.name);
  }
  if (card.slug.length > CARD_FIELD_LIMITS.slugMax) {
    fields.slug = fieldLimitMessage("slug", CARD_FIELD_LIMITS.slugMax);
  }
  if (card.role.length > CARD_FIELD_LIMITS.role) {
    fields.role = fieldLimitMessage("role", CARD_FIELD_LIMITS.role);
  }
  const phoneErr = phoneValidationMessage(card.phone ?? "");
  if (phoneErr) {
    fields.phone = phoneErr;
  }
  if (card.about.length > CARD_FIELD_LIMITS.aboutParagraphs) {
    fields.about = `Use at most ${CARD_FIELD_LIMITS.aboutParagraphs} paragraphs.`;
  }
  card.about.forEach((p, i) => {
    if (p.length > CARD_FIELD_LIMITS.aboutParagraph) {
      fields[`about.${i}`] = fieldLimitMessage(
        `about.${i}`,
        CARD_FIELD_LIMITS.aboutParagraph,
      );
    }
  });
  if (card.services.length > CARD_FIELD_LIMITS.services) {
    fields.services = `Use at most ${CARD_FIELD_LIMITS.services} services.`;
  }
  card.services.forEach((s, i) => {
    if (s.title.length > CARD_FIELD_LIMITS.serviceLabel) {
      fields[`services.${i}.title`] = fieldLimitMessage(
        `services.${i}.title`,
        CARD_FIELD_LIMITS.serviceLabel,
      );
    }
    if (s.description.length > CARD_FIELD_LIMITS.serviceDescription) {
      fields[`services.${i}.description`] = fieldLimitMessage(
        `services.${i}.description`,
        CARD_FIELD_LIMITS.serviceDescription,
      );
    }
  });

  for (const key of ["website", "linkedin", "github", "instagram"] as const) {
    const value = card.links[key] ?? "";
    if (value.length > CARD_FIELD_LIMITS.publicUrlMaxLength) {
      fields[`links.${key}`] = fieldLimitMessage(
        `links.${key}`,
        CARD_FIELD_LIMITS.publicUrlMaxLength,
      );
    }
  }

  if (card.alternate.label.length > CARD_FIELD_LIMITS.alternateLabel) {
    fields["alternate.label"] = fieldLimitMessage(
      "alternate.label",
      CARD_FIELD_LIMITS.alternateLabel,
    );
  }
  if (card.alternate.url.length > CARD_FIELD_LIMITS.publicUrlMaxLength) {
    fields["alternate.url"] = fieldLimitMessage(
      "alternate.url",
      CARD_FIELD_LIMITS.publicUrlMaxLength,
    );
  }

  return fields;
}

function collectPublishLimitAndUrlViolations(card: EditorCard): Record<string, string> {
  const fields = collectDraftLimitViolations(card);

  card.services.forEach((s, i) => {
    if (!s.title.trim() && s.description.trim()) {
      fields[`services.${i}.title`] = "Add a title for this service.";
    }
  });

  for (const key of ["website", "linkedin", "github", "instagram"] as const) {
    const value = card.links[key]?.trim() ?? "";
    if (value && !isHttpsUrl(value)) {
      fields[`links.${key}`] = "Use a full link that starts with https://";
    }
  }

  const altUrl = card.alternate.url.trim();
  const altLabel = card.alternate.label.trim();
  if (altUrl && !isHttpsUrl(altUrl)) {
    fields["alternate.url"] = "Use a full link that starts with https://";
  }
  if (!altUrl && altLabel) {
    fields["alternate.url"] = "Add the link this text should open.";
  }

  return fields;
}

export function validateEditorCardForDraft(card: EditorCard): EditorValidationResult {
  const fields = collectDraftLimitViolations(card);
  if (Object.keys(fields).length > 0) {
    return { ok: false, code: "invalid-fields", fields };
  }
  return { ok: true };
}

export function validateEditorCardForPublish(card: EditorCard): EditorValidationResult {
  const slug = card.slug.trim();
  const slugFmt = slugFormatCheck(slug);
  if (!slug || slugFmt || !isValidSlug(slug)) {
    return { ok: false, code: "slug-invalid" };
  }
  if (isReservedSlug(slug)) {
    return { ok: false, code: "slug-reserved" };
  }

  const fields = collectPublishLimitAndUrlViolations(card);
  if (Object.keys(fields).length > 0) {
    return { ok: false, code: "invalid-fields", fields };
  }

  return { ok: true };
}
