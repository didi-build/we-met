export const VCARD_DOWNLOAD_FRAME_ID = "we-met-vcard-download-frame";

export function vcardIframeIndicatesApiError(bodyText: string): boolean {
  const trimmed = bodyText.trim();
  if (!trimmed.startsWith("{")) {
    return false;
  }
  try {
    const parsed = JSON.parse(trimmed) as { error?: unknown };
    return typeof parsed.error === "string";
  } catch {
    return false;
  }
}
