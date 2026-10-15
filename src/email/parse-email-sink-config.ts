import { isPlainSingleEmailAddress } from "@/email/plain-email";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export type ParsedEmailSinkConfig = {
  to: string;
};

export function parseEmailSinkConfig(value: unknown): ParsedEmailSinkConfig | null {
  if (!isRecord(value) || !isNonEmptyString(value.to)) {
    return null;
  }
  if (!isPlainSingleEmailAddress(value.to)) {
    return null;
  }
  return { to: value.to };
}
