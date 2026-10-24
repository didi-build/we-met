import { FollowupEmailError } from "@/email/followup-email-error";
import { isPlainSingleEmailAddress } from "@/email/plain-email";

/** Non-prod consumer redirect target; never derived from queue fields. */
export function resolveNonProdTestMailTo(testMailTo: string | undefined): string {
  const redirect = testMailTo?.trim();
  if (!redirect) {
    throw new FollowupEmailError("nonprod_mail_redirect_unset");
  }
  return redirect;
}

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

  const redirect = resolveNonProdTestMailTo(input.testMailTo);

  return {
    mode: "nonprod",
    to: redirect,
    visitorEmailForContent: input.visitorEmail,
  };
}

export type ResolveSinkEmailRecipientInput = {
  weMetEnv: string;
  sinkDestinationEmail: string;
  testMailTo: string | undefined;
};

export type ResolveSinkEmailRecipientResult =
  | { mode: "production"; to: string }
  | { mode: "nonprod"; to: string; sinkDestinationForContent: string };

/** Sink owner mail: production → `sinkConfig.to`; non-prod → test inbox. */
export type ResolveOwnerSinkReplyToInput = {
  weMetEnv: string;
  visitorEmail: string;
  testMailTo: string | undefined;
};

/** Owner sink Reply-To: visitor in production; test inbox redirect otherwise. */
export function resolveOwnerSinkReplyTo(input: ResolveOwnerSinkReplyToInput): string {
  if (input.weMetEnv === "production") {
    return input.visitorEmail.trim();
  }
  return resolveNonProdTestMailTo(input.testMailTo);
}

export function resolveSinkEmailRecipient(
  input: ResolveSinkEmailRecipientInput,
): ResolveSinkEmailRecipientResult {
  const destination = input.sinkDestinationEmail.trim();
  if (!isPlainSingleEmailAddress(destination)) {
    throw new FollowupEmailError("malformed_sink_email_config");
  }

  if (input.weMetEnv === "production") {
    return { mode: "production", to: destination };
  }

  const redirect = resolveNonProdTestMailTo(input.testMailTo);

  return {
    mode: "nonprod",
    to: redirect,
    sinkDestinationForContent: destination,
  };
}
