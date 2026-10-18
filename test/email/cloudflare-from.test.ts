import { describe, expect, it } from "vitest";
import { resolveCloudflareFromEmail } from "@/email/cloudflare-from";
import { FollowupEmailError } from "@/email/followup-email-error";

describe("resolveCloudflareFromEmail (unit)", () => {
  it("returns trimmed plain address", () => {
    expect(resolveCloudflareFromEmail("  hello@mail.we-met.link  ")).toBe(
      "hello@mail.we-met.link",
    );
  });

  it("fails closed when unset, empty, or not a plain single address", () => {
    for (const value of [undefined, "", "  ", "not an email", "a@b.com, c@d.com"]) {
      expect(() => resolveCloudflareFromEmail(value)).toThrow(FollowupEmailError);
      try {
        resolveCloudflareFromEmail(value);
      } catch (error) {
        expect(error).toMatchObject({
          code: "cloudflare_from_email_missing",
          secretName: "WE_MET_EMAIL_FROM_CLOUDFLARE",
        });
      }
    }
  });
});
