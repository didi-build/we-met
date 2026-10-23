import { describe, expect, it, vi } from "vitest";
import { createConsumerOutboundEmailSend } from "@/email/email-provider";

describe("createConsumerOutboundEmailSend (unit)", () => {
  it("throws cloudflare_binding_missing when EMAIL is unset", async () => {
    const sendEmail = createConsumerOutboundEmailSend({});

    await expect(
      sendEmail({
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

  it("sends through the EMAIL binding when present", async () => {
    const emailSend = vi.fn(async () => ({ messageId: "<msg@mail.we-met.link>" }));
    const sendEmail = createConsumerOutboundEmailSend({
      EMAIL: { send: emailSend },
    });

    const result = await sendEmail({
      from: "hello@mail.we-met.link",
      to: "visitor@example.com",
      subject: "Hi",
      textPlain: "a",
      textHtml: "b",
    });

    expect(result).toEqual({ messageId: "<msg@mail.we-met.link>", threadId: null });
    expect(emailSend).toHaveBeenCalledOnce();
  });
});
