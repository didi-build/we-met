import { describe, expect, it } from "vitest";
import { FollowupEmailError } from "@/email/followup-email-error";
import {
  resolveEmailRecipient,
  resolveNonProdTestMailTo,
  resolveOwnerSinkReplyTo,
  resolveSinkEmailRecipient,
} from "@/email/recipient";

describe("resolveNonProdTestMailTo (unit)", () => {
  it("returns trimmed redirect address", () => {
    expect(resolveNonProdTestMailTo("  inbox@example.com  ")).toBe("inbox@example.com");
  });

  it("fails closed when unset", () => {
    expect(() => resolveNonProdTestMailTo(undefined)).toThrow(FollowupEmailError);
    expect(() => resolveNonProdTestMailTo("")).toThrow(FollowupEmailError);
  });
});

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
      name: "staging redirects to test inbox",
      weMetEnv: "staging",
      visitorEmail: "visitor@example.com",
      testMailTo: "test-inbox@example.com",
      expect: {
        mode: "nonprod" as const,
        to: "test-inbox@example.com",
        visitorEmailForContent: "visitor@example.com",
      },
    },
    {
      name: "staging fails closed when redirect unset",
      weMetEnv: "staging",
      visitorEmail: "visitor@example.com",
      testMailTo: undefined,
      throws: FollowupEmailError,
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

describe("resolveSinkEmailRecipient (unit)", () => {
  it("production sends to sink destination", () => {
    expect(
      resolveSinkEmailRecipient({
        weMetEnv: "production",
        sinkDestinationEmail: "owner@example.com",
        testMailTo: undefined,
      }),
    ).toEqual({ mode: "production", to: "owner@example.com" });
  });

  it("preview redirects sink mail to test inbox", () => {
    expect(
      resolveSinkEmailRecipient({
        weMetEnv: "preview",
        sinkDestinationEmail: "owner@example.com",
        testMailTo: "test-inbox@example.com",
      }),
    ).toEqual({
      mode: "nonprod",
      to: "test-inbox@example.com",
      sinkDestinationForContent: "owner@example.com",
    });
  });

  it("staging redirects sink mail to test inbox", () => {
    expect(
      resolveSinkEmailRecipient({
        weMetEnv: "staging",
        sinkDestinationEmail: "owner@example.com",
        testMailTo: "test-inbox@example.com",
      }),
    ).toEqual({
      mode: "nonprod",
      to: "test-inbox@example.com",
      sinkDestinationForContent: "owner@example.com",
    });
  });
});

describe("resolveOwnerSinkReplyTo (unit)", () => {
  it("production uses visitor email", () => {
    expect(
      resolveOwnerSinkReplyTo({
        weMetEnv: "production",
        visitorEmail: "visitor@example.com",
        testMailTo: undefined,
      }),
    ).toBe("visitor@example.com");
  });

  it("staging redirects Reply-To to test inbox", () => {
    expect(
      resolveOwnerSinkReplyTo({
        weMetEnv: "staging",
        visitorEmail: "visitor@example.com",
        testMailTo: "test-inbox@example.com",
      }),
    ).toBe("test-inbox@example.com");
  });
});
