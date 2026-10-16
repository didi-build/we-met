export class PublishCardError extends Error {
  readonly code: "slug-locked" | "slug-taken" | "forbidden" | "card-not-live";

  constructor(code: PublishCardError["code"], message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "PublishCardError";
  }
}

export function mapD1UniqueToPublishError(message: string): PublishCardError | null {
  if (
    message.includes("cards_slug_unique") ||
    message.includes("cards.slug") ||
    /UNIQUE constraint failed:\s*cards\.slug/i.test(message)
  ) {
    return new PublishCardError("slug-taken");
  }
  if (message.includes("cards_one_per_account")) {
    return null;
  }
  return null;
}
