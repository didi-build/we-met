import { describe, expect, it } from "vitest";
import { FollowupEmailError } from "@/email/followup-email-error";
import { resolveEmailRecipient } from "@/email/recipient";

describe("resolveEmailRecipient (unit)", () => {
  const cases = [
    {
      name: "production sends to visitor",
      weMetEnv: "production",
      visitorEmail: "visitor@example.com",
      testMailTo: undefined,
      expect: { mode: "production" as const, to: "visitor@example.com" },
    },
    {
      name: "preview redirects to test inbox",
      weMetEnv: "preview",
      visitorEmail: "visitor@example.com",
      testMailTo: "test-inbox@example.com",
      expect: {
        mode: "nonprod" as const,
        to: "test-inbox@example.com",
        visitorEmailForContent: "visitor@example.com",
      },
    },
    {
      name: "local redirects to test inbox",
      weMetEnv: "local",
      visitorEmail: "a@example.com",
      testMailTo: "inbox@example.com",
      expect: {
        mode: "nonprod" as const,
        to: "inbox@example.com",
        visitorEmailForContent: "a@example.com",
      },
    },
    {
      name: "non-production fails closed when redirect unset",
      weMetEnv: "preview",
      visitorEmail: "visitor@example.com",
      testMailTo: "",
      throws: FollowupEmailError,
    },
    {
      name: "ignores misleading production-like env strings",
      weMetEnv: "production-preview",
      visitorEmail: "visitor@example.com",
      testMailTo: "inbox@example.com",
      expect: {
        mode: "nonprod" as const,
        to: "inbox@example.com",
        visitorEmailForContent: "visitor@example.com",
      },
    },
  ];

  for (const row of cases) {
    it(row.name, () => {
      if (row.throws) {
        expect(() =>
          resolveEmailRecipient({
            weMetEnv: row.weMetEnv,
            visitorEmail: row.visitorEmail,
            testMailTo: row.testMailTo,
          }),
        ).toThrow(row.throws);
        return;
      }
      const result = resolveEmailRecipient({
        weMetEnv: row.weMetEnv,
        visitorEmail: row.visitorEmail,
        testMailTo: row.testMailTo,
      });
      expect(result).toEqual(row.expect);
    });
  }
});
