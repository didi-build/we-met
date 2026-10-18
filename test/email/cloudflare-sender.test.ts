import { describe, expect, it, vi } from "vitest";
import {
  createCloudflareEmailSender,
  type CloudflareOutboundMessage,
  type CloudflareSendEmailBinding,
} from "@/email/cloudflare-sender";

describe("createCloudflareEmailSender (unit)", () => {
  it("maps outbound mail to the binding and returns messageId with null threadId", async () => {
    const send = vi.fn(async (_message: CloudflareOutboundMessage) => ({
      messageId: "<abc@mail.we-met.link>",
    }));
    const sender = createCloudflareEmailSender({
      send: send as CloudflareSendEmailBinding["send"],
    });

    const result = await sender.send({
      from: "hello@mail.we-met.link",
      fromDisplayName: "We Met",
      to: "visitor@example.com",
      replyTo: "owner@example.com",
      subject: "Hi",
      textPlain: "plain",
      textHtml: "<p>html</p>",
      messageId: "<ignored@we-met.link>",
      threadId: "gmail-thread",
      attachments: [
        {
          filename: "card.vcf",
          mimeType: "text/vcard",
          body: "BEGIN:VCARD\nEND:VCARD",
        },
      ],
    });

    expect(result).toEqual({
      messageId: "<abc@mail.we-met.link>",
      threadId: null,
    });
    expect(send).toHaveBeenCalledOnce();
    const payload = send.mock.calls[0]![0]!;
    expect(payload.from).toEqual({
      email: "hello@mail.we-met.link",
      name: "We Met",
    });
    expect(payload.headers).toBeUndefined();
    expect(payload.attachments?.[0]?.content).toBeTruthy();
    expect(payload.attachments?.[0]?.disposition).toBe("attachment");
  });

  it("sets In-Reply-To and References only when both are present", async () => {
    const send = vi.fn(async (_message: CloudflareOutboundMessage) => ({
      messageId: "<r@mail.we-met.link>",
    }));
    const sender = createCloudflareEmailSender({
      send: send as CloudflareSendEmailBinding["send"],
    });

    await sender.send({
      from: "hello@mail.we-met.link",
      to: "owner@example.com",
      subject: "Re: lead",
      textPlain: "a",
      textHtml: "b",
      inReplyTo: "<record@mail.we-met.link>",
      references: "<record@mail.we-met.link>",
    });

    expect(send.mock.calls[0]![0]!.headers).toEqual({
      "In-Reply-To": "<record@mail.we-met.link>",
      References: "<record@mail.we-met.link>",
    });
  });

  it("wraps binding errors as cloudflare_* FollowupEmailError codes", async () => {
    const send = vi.fn(async () => {
      const error = new Error("rate limited") as Error & { code: string };
      error.code = "E_RATE_LIMIT_EXCEEDED";
      throw error;
    });
    const sender = createCloudflareEmailSender({ send });

    await expect(
      sender.send({
        from: "hello@mail.we-met.link",
        to: "visitor@example.com",
        subject: "Hi",
        textPlain: "plain",
        textHtml: "<p>html</p>",
      }),
    ).rejects.toMatchObject({
      code: "cloudflare_E_RATE_LIMIT_EXCEEDED",
    });
  });
});

describe("isRetryableFollowupEmailError (unit)", () => {
  it("treats Cloudflare header errors as permanent", async () => {
    const { isRetryableFollowupEmailError } =
      await import("@/email/retryable-followup-error");
    expect(isRetryableFollowupEmailError("cloudflare_E_HEADER_NOT_ALLOWED")).toBe(
      false,
    );
    expect(isRetryableFollowupEmailError("cloudflare_E_RATE_LIMIT_EXCEEDED")).toBe(
      true,
    );
    expect(isRetryableFollowupEmailError("malformed_sink_email_config")).toBe(false);
  });
});
