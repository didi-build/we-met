import { isValidSlug } from "@/card-data/slug";
import type { ProcessVCardResult } from "@/exchange/process-vcard";

export type VcardFormRedirectReason = "expired" | "limited";

/**
 * Form POST error mapping (documented in app-api-contract.md):
 * - expired: invalid_token, card_not_found, invalid_input (malformed body/token)
 * - limited: rate_limited, server_error (transient; keep exchange session)
 */
export function vcardFormErrorToRedirectReason(
  error: ProcessVCardResult["status"] | "invalid_input" | "invalid_host",
): VcardFormRedirectReason {
  switch (error) {
    case "rate_limited":
    case "server_error":
      return "limited";
    case "invalid_token":
    case "card_not_found":
    case "invalid_input":
    case "invalid_host":
      return "expired";
    default:
      return "expired";
  }
}

export function normalizeVcardFormSlug(
  raw: string | undefined | null,
): string | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (!trimmed || !isValidSlug(trimmed)) {
    return undefined;
  }
  return trimmed;
}

/** Relative redirect only; rejects open-redirect patterns via slug validation. */
export function buildVcardFormRedirectLocation(
  slug: string | undefined,
  reason: VcardFormRedirectReason,
): string {
  const safeSlug = normalizeVcardFormSlug(slug);
  if (!safeSlug) {
    return "/";
  }
  return `/hi/${safeSlug}?vcard=${reason}`;
}
