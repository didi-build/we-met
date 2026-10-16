import type {
  AppCardBundle,
  AppSession,
  EditorCard,
  SlugCheckResult,
} from "@/app-api/types";

/**
 * Single seam between the app UI and backend implementations (stub or HTTP).
 * Shapes and error codes are documented in docs/architecture/app-api-contract.md.
 */
export interface AppApi {
  /** Returns the signed-in user, or null when signed out. */
  getSession(): Promise<AppSession | null>;

  /**
   * Starts Google sign-in and returns the session on success.
   * @throws {AppApiError} `canceled` | `closed` | `failed` | `network`
   */
  signIn(mode?: "redirect" | "popup"): Promise<AppSession>;

  /** Clears the session. */
  signOut(): Promise<void>;

  /** Loads draft and published card for the signed-in user. */
  getCard(): Promise<AppCardBundle>;

  /**
   * Persists the draft card.
   * @returns server `updatedAt` for the draft
   * @throws {AppApiError} `unauthorized` when the session expired; `network` otherwise
   */
  saveDraft(card: EditorCard): Promise<{ updatedAt: string }>;

  /**
   * Checks whether a slug is available (owner's current slug is always available).
   * @throws {AppApiError} `network` on unexpected failure
   */
  checkSlug(slug: string): Promise<SlugCheckResult>;

  /**
   * Stores a cropped 512×512 JPEG and returns a URL for the draft.
   * @throws {AppApiError} `network` on failure
   */
  uploadPhoto(blob: Blob): Promise<{ url: string }>;

  /**
   * Publishes the draft as the live card.
   * @throws {AppApiError} publish validation codes or `unauthorized` | `network`
   */
  publish(card: EditorCard): Promise<{ url: string }>;
}
