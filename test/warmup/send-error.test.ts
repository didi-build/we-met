import { describe, expect, it } from "vitest";
import {
  isPermanentWarmupSendError,
  extractEmailSendErrorCode,
} from "../../workers/warmup/lib/send-error";

describe("warmup send error classification (unit)", () => {
  it("treats Cloudflare EmailAddress type errors as permanent", () => {
    const error = new Error(
      "Incorrect type for the 'name' field on 'EmailAddress': the provided value is not of type 'string'.",
    );
    expect(isPermanentWarmupSendError(error)).toBe(true);
    expect(extractEmailSendErrorCode(error)).toBeUndefined();
  });

  it("does not treat transient transport errors as permanent", () => {
    expect(isPermanentWarmupSendError(new Error("timeout"))).toBe(false);
    const suppressed = new Error("suppressed");
    (suppressed as Error & { code: string }).code = "E_RECIPIENT_SUPPRESSED";
    expect(isPermanentWarmupSendError(suppressed)).toBe(false);
  });
});
