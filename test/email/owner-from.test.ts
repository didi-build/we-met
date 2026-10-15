import { describe, expect, it } from "vitest";
import { FollowupEmailError } from "@/email/followup-email-error";
import { resolveOwnerFromEmail } from "@/email/owner-from";

describe("resolveOwnerFromEmail (unit)", () => {
  it("returns trimmed plain address", () => {
    expect(resolveOwnerFromEmail("  hello@we-met.link  ")).toBe("hello@we-met.link");
  });

  it("fails closed when unset or not a plain single address", () => {
    for (const value of [undefined, "", "  ", "a@b.com, c@d.com", "not-an-email"]) {
      expect(() => resolveOwnerFromEmail(value)).toThrow(FollowupEmailError);
      try {
        resolveOwnerFromEmail(value);
      } catch (error) {
        expect(error).toMatchObject({
          code: "owner_from_email_missing",
          secretName: "WE_MET_OWNER_FROM_EMAIL",
        });
      }
    }
  });
});
