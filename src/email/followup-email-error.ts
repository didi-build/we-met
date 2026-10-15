export type FollowupEmailErrorCode =
  | "gmail_secret_missing"
  | "gmail_invalid_service_account_json"
  | `gmail_token_http_${number}`
  | "gmail_token_missing_access_token"
  | `gmail_send_http_${number}`
  | "gmail_network_error"
  | "nonprod_mail_redirect_unset"
  | "owner_from_email_missing"
  | "malformed_sink_email_config"
  | "invalid_rfc5322_message_id"
  | "unknown";

export class FollowupEmailError extends Error {
  readonly code: FollowupEmailErrorCode;
  /** Set only for gmail_secret_missing — secret name, never a value. */
  readonly secretName?: string;

  constructor(code: FollowupEmailErrorCode, options?: { secretName?: string }) {
    super(code);
    this.name = "FollowupEmailError";
    this.code = code;
    this.secretName = options?.secretName;
  }
}

export function errorCodeFromUnknown(error: unknown): FollowupEmailErrorCode {
  return followupEmailErrorLogFields(error).code;
}

export type FollowupEmailErrorLogFields = {
  code: FollowupEmailErrorCode;
  secretName?: string;
};

/** Safe structured fields for consumer logs — never secret values. */
export function followupEmailErrorLogFields(
  error: unknown,
): FollowupEmailErrorLogFields {
  if (error instanceof FollowupEmailError) {
    const fields: FollowupEmailErrorLogFields = { code: error.code };
    if (
      (error.code === "gmail_secret_missing" ||
        error.code === "owner_from_email_missing") &&
      error.secretName
    ) {
      fields.secretName = error.secretName;
    }
    return fields;
  }
  return { code: "unknown" };
}
