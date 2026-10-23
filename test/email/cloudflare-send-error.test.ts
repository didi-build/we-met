import { describe, expect, it } from "vitest";
import { isPermanentCloudflareSendError } from "@/email/cloudflare-send-error";

describe("isPermanentCloudflareSendError (unit)", () => {
  it("treats Cloudflare EmailAddress type errors as permanent", () => {
    const error = new Error(
      "Incorrect type for the 'name' field on 'EmailAddress': the provided value is not of type 'string'.",
    );
    expect(isPermanentCloudflareSendError(error)).toBe(true);
  });

  it("treats plain objects with a message field as permanent when the text matches", () => {
    expect(
      isPermanentCloudflareSendError({
        message:
          "Incorrect type for the 'name' field on 'EmailAddress': the provided value is not of type 'string'.",
      }),
    ).toBe(true);
  });

  it("does not treat transient transport errors as permanent", () => {
    expect(isPermanentCloudflareSendError(new Error("timeout"))).toBe(false);
    const suppressed = new Error("suppressed");
    (suppressed as Error & { code: string }).code = "E_RECIPIENT_SUPPRESSED";
    expect(isPermanentCloudflareSendError(suppressed)).toBe(false);
  });
});
