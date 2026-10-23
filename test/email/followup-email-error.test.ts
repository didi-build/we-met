import { describe, expect, it } from "vitest";
import {
  errorCodeFromUnknown,
  followupEmailErrorLogFields,
  FollowupEmailError,
} from "@/email/followup-email-error";

describe("FollowupEmailError (unit)", () => {
  const thrownToCode: Array<{ throw: () => void; code: string }> = [
    {
      throw: () => {
        throw new FollowupEmailError("cloudflare_binding_missing");
      },
      code: "cloudflare_binding_missing",
    },
    {
      throw: () => {
        throw new FollowupEmailError("cloudflare_from_email_missing", {
          secretName: "WE_MET_EMAIL_FROM_CLOUDFLARE",
        });
      },
      code: "cloudflare_from_email_missing",
    },
    {
      throw: () => {
        throw new FollowupEmailError("nonprod_mail_redirect_unset");
      },
      code: "nonprod_mail_redirect_unset",
    },
    {
      throw: () => {
        throw new Error("unexpected");
      },
      code: "unknown",
    },
  ];

  for (const row of thrownToCode) {
    it(`maps thrown error to code ${row.code}`, () => {
      try {
        row.throw();
        expect.fail("expected throw");
      } catch (error) {
        expect(errorCodeFromUnknown(error)).toBe(row.code);
      }
    });
  }

  it("followupEmailErrorLogFields includes secretName for secret-related codes", () => {
    const missing = followupEmailErrorLogFields(
      new FollowupEmailError("cloudflare_from_email_missing", {
        secretName: "WE_MET_EMAIL_FROM_CLOUDFLARE",
      }),
    );
    expect(missing).toEqual({
      code: "cloudflare_from_email_missing",
      secretName: "WE_MET_EMAIL_FROM_CLOUDFLARE",
    });

    const fromDisplay = followupEmailErrorLogFields(
      new FollowupEmailError("from_display_name_missing", {
        secretName: "WE_MET_FROM_DISPLAY_NAME",
      }),
    );
    expect(fromDisplay).toEqual({
      code: "from_display_name_missing",
      secretName: "WE_MET_FROM_DISPLAY_NAME",
    });

    const binding = followupEmailErrorLogFields(
      new FollowupEmailError("cloudflare_binding_missing"),
    );
    expect(binding).toEqual({ code: "cloudflare_binding_missing" });
    expect(binding.secretName).toBeUndefined();
  });
});
