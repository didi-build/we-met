import { ACCOUNT_EMAIL_SENTINEL } from "@/card-data/account-email";
import { registerLeadSinkKind } from "@/card-data/lead-sink-registry";

const PLAIN_EMAIL_FORBIDDEN = /[\s,;<>"\\()\u0000-\u001f\u007f]/;

export type EmailLeadSinkConfig = {
  to: string;
};

function assertAllowedKeys(
  raw: Record<string, unknown>,
  allowed: string[],
  label: string,
): void {
  for (const key of Object.keys(raw)) {
    if (!allowed.includes(key)) {
      throw new Error(`Unexpected field "${key}" in ${label}`);
    }
  }
}

export function isPlainSingleEmailAddress(email: string): boolean {
  if (!email || PLAIN_EMAIL_FORBIDDEN.test(email)) {
    return false;
  }
  const at = email.indexOf("@");
  if (at <= 0 || email.indexOf("@", at + 1) !== -1) {
    return false;
  }
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return local.length > 0 && domain.length > 0;
}

function parseEmailLeadSinkConfig(raw: unknown): EmailLeadSinkConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error('email sink config must be an object with a "to" field');
  }
  const record = raw as Record<string, unknown>;
  assertAllowedKeys(record, ["to"], "email sink config");
  if (typeof record.to !== "string") {
    throw new Error('email sink config requires a string "to" field');
  }
  const to = record.to.trim();
  if (!to) {
    throw new Error('email sink config "to" must not be empty');
  }
  if (to === ACCOUNT_EMAIL_SENTINEL) {
    return { to: ACCOUNT_EMAIL_SENTINEL };
  }
  throw new Error('email sink config "to" must be account_email in v1');
}

export function registerEmailLeadSinkKind(): void {
  registerLeadSinkKind("email", {
    parse: parseEmailLeadSinkConfig,
  });
}
