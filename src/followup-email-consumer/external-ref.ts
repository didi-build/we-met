import type { ParsedExternalRef } from "@/followup-email-consumer/lead-sink/types";

const MAX_EXTERNAL_REF_BYTES = 1024;

function isFlatJsonValue(value: unknown): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

export function parseExternalRef(json: string | null): ParsedExternalRef | null {
  if (json === null) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  for (const value of Object.values(record)) {
    if (!isFlatJsonValue(value)) {
      return null;
    }
  }
  return record as ParsedExternalRef;
}

export function validateExternalRefForStorage(
  externalRef: string | null,
): { ok: true; stored: string | null } | { ok: false; code: "external_ref_invalid" } {
  if (externalRef === null) {
    return { ok: true, stored: null };
  }
  if (new TextEncoder().encode(externalRef).length > MAX_EXTERNAL_REF_BYTES) {
    return { ok: false, code: "external_ref_invalid" };
  }
  const parsed = parseExternalRef(externalRef);
  if (parsed === null) {
    return { ok: false, code: "external_ref_invalid" };
  }
  return { ok: true, stored: externalRef };
}
