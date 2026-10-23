import { describe, expect, it, vi } from "vitest";
import {
  createCloudflareEmailSender,
  type CloudflareOutboundMessage,
  type CloudflareSendEmailBinding,
} from "@/email/cloudflare-sender";
import { FollowupEmailError } from "@/email/followup-email-error";
import { CLOUDFLARE_FROM_DISPLAY_NAME_FALLBACK } from "@/email/from-display-name";

function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function bindingError(code: string): Error & { code: string } {
  const error = new Error(code) as Error & { code: string };
  error.code = code;
  return error;
}

describe("createCloudflareEmailSender (unit)", () => {
  it("maps outbound mail to the binding and returns messageId with null threadId", async () => {
    const send = vi.fn(async (_message: CloudflareOutboundMessage) => ({
      messageId: "<abc@mail.we-met.link>",
    }));
    const sender = createCloudflareEmailSender({
      send: send as CloudflareSendEmailBinding["send"],
    });

    const vcardBody = "BEGIN:VCARD\nFN:José\nEND:VCARD";
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
          body: vcardBody,
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
    expect(decodeBase64Utf8(payload.attachments![0]!.content)).toBe(vcardBody);
    expect(payload.attachments?.[0]?.disposition).toBe("attachment");
  });

  it.each([
    ["missing", undefined, CLOUDFLARE_FROM_DISPLAY_NAME_FALLBACK],
    ["empty", "", CLOUDFLARE_FROM_DISPLAY_NAME_FALLBACK],
    ["whitespace", "  \t ", CLOUDFLARE_FROM_DISPLAY_NAME_FALLBACK],
    ["set", "  Custom Name  ", "Custom Name"],
  ])(
    "always sends a string from.name when display name is %s",
    async (_label, fromDisplayName, expectedName) => {
      const send = vi.fn(async (_message: CloudflareOutboundMessage) => ({
        messageId: "<n@mail.we-met.link>",
      }));
      const sender = createCloudflareEmailSender({
        send: send as CloudflareSendEmailBinding["send"],
      });

      await sender.send({
        from: "hello@mail.we-met.link",
        ...(fromDisplayName !== undefined ? { fromDisplayName } : {}),
        to: "visitor@example.com",
        subject: "Hi",
        textPlain: "plain",
        textHtml: "<p>html</p>",
      });

      expect(send).toHaveBeenCalledOnce();
      const from = send.mock.calls[0]![0]!.from;
      expect(from.name).toBe(expectedName);
      expect(typeof from.name).toBe("string");
      expect(from.name.length).toBeGreaterThan(0);
    },
  );

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

  it("omits threading headers when only one of inReplyTo or references is set", async () => {
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
    });

    expect(send.mock.calls[0]![0]!.headers).toBeUndefined();
  });

  it.each([
    ["E_RATE_LIMIT_EXCEEDED", "cloudflare_E_RATE_LIMIT_EXCEEDED"],
    ["E_DAILY_LIMIT_EXCEEDED", "cloudflare_E_DAILY_LIMIT_EXCEEDED"],
    ["E_DELIVERY_FAILED", "cloudflare_E_DELIVERY_FAILED"],
    ["E_RECIPIENT_SUPPRESSED", "cloudflare_E_RECIPIENT_SUPPRESSED"],
    ["E_CONTENT_TOO_LARGE", "cloudflare_E_CONTENT_TOO_LARGE"],
  ])("maps binding error %s to %s", async (bindingCode, expectedCode) => {
    const send = vi.fn(async () => {
      throw bindingError(bindingCode);
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
    ).rejects.toMatchObject({ code: expectedCode });
  });

  it("maps non-E_* binding codes and missing codes to unknown", async () => {
    const sendInvalid = vi.fn(async () => {
      throw bindingError("not_an_e_code");
    });
    await expect(
      createCloudflareEmailSender({ send: sendInvalid }).send({
        from: "hello@mail.we-met.link",
        to: "visitor@example.com",
        subject: "Hi",
        textPlain: "plain",
        textHtml: "<p>html</p>",
      }),
    ).rejects.toMatchObject({ code: "unknown" });

    const sendNoCode = vi.fn(async () => {
      throw new Error("network");
    });
    await expect(
      createCloudflareEmailSender({ send: sendNoCode }).send({
        from: "hello@mail.we-met.link",
        to: "visitor@example.com",
        subject: "Hi",
        textPlain: "plain",
        textHtml: "<p>html</p>",
      }),
    ).rejects.toMatchObject({ code: "unknown" });
  });

  it("maps Cloudflare send validation errors to a non-retryable code", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const send = vi.fn(async () => {
      throw new Error(
        "Incorrect type for the 'name' field on 'EmailAddress': the provided value is not of type 'string'.",
      );
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
    ).rejects.toMatchObject({ code: "cloudflare_send_validation_failed" });

    expect(consoleError).toHaveBeenCalledWith("cloudflare_send_permanent_failure", {
      reason: "send_validation",
    });
    consoleError.mockRestore();
  });

  it("re-throws FollowupEmailError from the binding unchanged", async () => {
    const send = vi.fn(async () => {
      throw new FollowupEmailError("cloudflare_binding_missing");
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
    ).rejects.toMatchObject({ code: "cloudflare_binding_missing" });
  });
});

describe("isRetryableFollowupEmailError (unit)", () => {
  it("classifies Cloudflare binding error codes for retry policy", async () => {
    const { isRetryableFollowupEmailError } =
      await import("@/email/retryable-followup-error");
    expect(isRetryableFollowupEmailError("cloudflare_E_HEADER_NOT_ALLOWED")).toBe(
      false,
    );
    expect(isRetryableFollowupEmailError("cloudflare_E_RECIPIENT_SUPPRESSED")).toBe(
      false,
    );
    expect(isRetryableFollowupEmailError("cloudflare_E_CONTENT_TOO_LARGE")).toBe(false);
    expect(isRetryableFollowupEmailError("cloudflare_E_RATE_LIMIT_EXCEEDED")).toBe(
      true,
    );
    expect(isRetryableFollowupEmailError("cloudflare_E_DAILY_LIMIT_EXCEEDED")).toBe(
      true,
    );
    expect(isRetryableFollowupEmailError("cloudflare_E_DELIVERY_FAILED")).toBe(true);
    expect(isRetryableFollowupEmailError("unknown")).toBe(true);
    expect(isRetryableFollowupEmailError("malformed_sink_email_config")).toBe(false);
    expect(isRetryableFollowupEmailError("cloudflare_send_validation_failed")).toBe(
      false,
    );
  });
});
