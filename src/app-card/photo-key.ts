/** Content-addressed card photo keys stored in R2 (SHA-256 hex). */
export const PHOTO_KEY_HEX_LENGTH = 64;

const PHOTO_KEY_PATTERN = /^[a-f0-9]{64}$/;

export function isValidPhotoKey(key: string): boolean {
  return PHOTO_KEY_PATTERN.test(key);
}

export function parsePhotoKeyFromDraftPhotoUrl(photo: string): string | null {
  const trimmed = photo.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.includes("/api/app/photo")) {
    try {
      const url = new URL(trimmed, "https://we-met.link");
      const key = url.searchParams.get("v")?.trim() ?? "";
      return isValidPhotoKey(key) ? key : null;
    } catch {
      return null;
    }
  }
  return isValidPhotoKey(trimmed) ? trimmed : null;
}
