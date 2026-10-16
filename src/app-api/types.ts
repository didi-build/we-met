import type { CardPublicLinksMap } from "@/card-data/types";

/** Draft/published card shape for the app editor (matches design/app/app.js). */
export type EditorCard = {
  slug: string;
  name: string;
  role: string;
  photo: string;
  about: string[];
  services: { title: string; description: string }[];
  links: CardPublicLinksMap;
  alternate: { url: string; label: string };
};

export type AppSession = {
  email: string;
  name: string;
  allowed: boolean;
};

export type AppCardBundle = {
  draft: EditorCard;
  published: EditorCard | null;
  updatedAt: string;
};

export type SlugCheckResult =
  | { status: "available" }
  | { status: "taken" }
  | { status: "reserved" }
  | { status: "invalid"; message: string };

export type AppApiErrorCode =
  | "network"
  | "unauthorized"
  | "forbidden"
  | "canceled"
  | "closed"
  | "failed"
  | "slug-taken"
  | "slug-reserved"
  | "slug-invalid"
  | "name-missing";

export class AppApiError extends Error {
  readonly code: AppApiErrorCode;

  constructor(code: AppApiErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "AppApiError";
  }
}
