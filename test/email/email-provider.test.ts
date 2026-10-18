import { describe, expect, it } from "vitest";
import { createConsumerOutboundEmailSend } from "@/email/email-provider";

describe("createConsumerOutboundEmailSend (unit)", () => {
  it("throws cloudflare_binding_missing when provider is cloudflare and EMAIL is unset", async () => {
    const sendEmail = createConsumerOutboundEmailSend({
      GMAIL_SERVICE_ACCOUNT_JSON: "{}",
      GMAIL_SENDER: "delegated@example.com",
    });

    await expect(
      sendEmail("cloudflare", {
        from: "hello@mail.we-met.link",
        to: "visitor@example.com",
        subject: "Hi",
        textPlain: "a",
        textHtml: "b",
      }),
    ).rejects.toMatchObject({
      code: "cloudflare_binding_missing",
    });
  });
});
