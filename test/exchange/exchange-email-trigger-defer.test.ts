import { describe, expect, it } from "vitest";
import { shouldDeferExchangeEmailForTrigger } from "@/exchange/exchange-email-trigger-defer";
import { EXCHANGE_EMAIL_TRIGGER_DEFER_MAX_MS } from "@/exchange/owner-email-timing";

describe("shouldDeferExchangeEmailForTrigger (unit)", () => {
  const triggeredAt = "2026-10-12T12:00:00.000Z";
  const nowInsideWindow = new Date(
    Date.parse(triggeredAt) + EXCHANGE_EMAIL_TRIGGER_DEFER_MAX_MS - 1000,
  );

  it("does not defer when details were not triggered", () => {
    expect(
      shouldDeferExchangeEmailForTrigger(
        "owner_email",
        { triggeredAt: null, ownerEmailSentAt: null, visitorLetterSentAt: null },
        nowInsideWindow,
      ),
    ).toBe(false);
  });

  it("defers owner_email until owner email is sent", () => {
    expect(
      shouldDeferExchangeEmailForTrigger(
        "owner_email",
        {
          triggeredAt,
          ownerEmailSentAt: null,
          visitorLetterSentAt: "2026-10-12T12:01:00.000Z",
        },
        nowInsideWindow,
      ),
    ).toBe(true);
  });

  it("defers visitor_letter until visitor letter is sent", () => {
    expect(
      shouldDeferExchangeEmailForTrigger(
        "visitor_letter",
        {
          triggeredAt,
          ownerEmailSentAt: "2026-10-12T12:01:00.000Z",
          visitorLetterSentAt: null,
        },
        nowInsideWindow,
      ),
    ).toBe(true);
  });

  it("stops deferring after the bounded window", () => {
    const nowAfterWindow = new Date(
      Date.parse(triggeredAt) + EXCHANGE_EMAIL_TRIGGER_DEFER_MAX_MS + 1,
    );
    expect(
      shouldDeferExchangeEmailForTrigger(
        "owner_email",
        { triggeredAt, ownerEmailSentAt: null, visitorLetterSentAt: null },
        nowAfterWindow,
      ),
    ).toBe(false);
  });
});
