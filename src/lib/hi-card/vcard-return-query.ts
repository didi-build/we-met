export const VCARD_RETURN_QUERY_KEY = "vcard";

export type VcardReturnReason = "expired" | "limited";

export function parseVcardReturnReason(value: string | null): VcardReturnReason | null {
  if (value === "expired" || value === "limited") {
    return value;
  }
  return null;
}
