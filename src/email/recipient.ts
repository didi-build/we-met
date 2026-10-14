export type ResolveEmailRecipientInput = {
  /** Consumer Wrangler var only — never from queue messages. */
  weMetEnv: string;
  visitorEmail: string;
  /** Non-prod consumer secret; ignored in production mode. */
  testMailTo: string | undefined;
};

export type ResolveEmailRecipientResult =
  | { mode: "production"; to: string }
  | { mode: "nonprod"; to: string; visitorEmailForContent: string };

export class NonProdMailRedirectUnsetError extends Error {
  constructor() {
    super("nonprod_mail_redirect_unset");
    this.name = "NonProdMailRedirectUnsetError";
  }
}

/**
 * Single place for mail safety: production sends to the visitor; every other
 * `weMetEnv` redirects to `WE_MET_TEST_MAIL_TO` (fail closed if unset).
 */
export function resolveEmailRecipient(
  input: ResolveEmailRecipientInput,
): ResolveEmailRecipientResult {
  if (input.weMetEnv === "production") {
    return { mode: "production", to: input.visitorEmail };
  }

  const redirect = input.testMailTo?.trim();
  if (!redirect) {
    throw new NonProdMailRedirectUnsetError();
  }

  return {
    mode: "nonprod",
    to: redirect,
    visitorEmailForContent: input.visitorEmail,
  };
}
