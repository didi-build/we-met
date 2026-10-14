import { describe, expect, it } from "vitest";
import {
  errorCodeFromUnknown,
  followupEmailErrorLogFields,
  FollowupEmailError,
} from "@/email/followup-email-error";
import { parseServiceAccountJson } from "@/email/gmail-sender";

describe("FollowupEmailError (unit)", () => {
  const thrownToCode: Array<{ throw: () => void; code: string }> = [
    {
      throw: () => {
        throw new FollowupEmailError("gmail_secret_missing", {
          secretName: "GMAIL_SENDER",
        });
      },
      code: "gmail_secret_missing",
    },
    {
      throw: () => {
        throw new FollowupEmailError("gmail_invalid_service_account_json");
      },
      code: "gmail_invalid_service_account_json",
    },
    {
      throw: () => {
        throw new FollowupEmailError("gmail_token_http_403");
      },
      code: "gmail_token_http_403",
    },
    {
      throw: () => {
        throw new FollowupEmailError("gmail_token_missing_access_token");
      },
      code: "gmail_token_missing_access_token",
    },
    {
      throw: () => {
        throw new FollowupEmailError("gmail_send_http_500");
      },
      code: "gmail_send_http_500",
    },
    {
      throw: () => {
        throw new FollowupEmailError("gmail_network_error");
      },
      code: "gmail_network_error",
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

  it("followupEmailErrorLogFields includes secretName only for gmail_secret_missing", () => {
    const missing = followupEmailErrorLogFields(
      new FollowupEmailError("gmail_secret_missing", { secretName: "GMAIL_SENDER" }),
    );
    expect(missing).toEqual({
      code: "gmail_secret_missing",
      secretName: "GMAIL_SENDER",
    });

    const network = followupEmailErrorLogFields(
      new FollowupEmailError("gmail_network_error"),
    );
    expect(network).toEqual({ code: "gmail_network_error" });
    expect(network.secretName).toBeUndefined();

    const invalidJson = followupEmailErrorLogFields(
      new FollowupEmailError("gmail_invalid_service_account_json"),
    );
    expect(invalidJson.secretName).toBeUndefined();
  });

  it("does not leak secret fragments from JSON.parse failures", () => {
    const secretFragment = "super-secret-private-key-material";
    const raw = `{"private_key":"${secretFragment}"`;
    try {
      parseServiceAccountJson(raw);
      expect.fail("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(FollowupEmailError);
      const code = errorCodeFromUnknown(error);
      expect(code).toBe("gmail_invalid_service_account_json");
      expect(code).not.toContain(secretFragment);
      if (error instanceof Error) {
        expect(error.message).not.toContain(secretFragment);
      }
    }
  });
});
