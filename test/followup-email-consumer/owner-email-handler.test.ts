import { describe, expect, it, vi } from "vitest";
import type { OutboundEmail } from "@/email/types";
import { createEmailLeadSinkHandler } from "@/followup-email-consumer/lead-sink/email-handler";

describe("createEmailLeadSinkHandler owner email (unit)", () => {
  it("sends to the owner with visitor Reply-To in production for owner_relay", async () => {
    const sendEmail = vi.fn(async (_message: OutboundEmail) => ({
      messageId: "msg-1",
      threadId: null,
    }));
    const handler = createEmailLeadSinkHandler({
      weMetEnv: "production",
      outboundFrom: { cloudflareFromEmail: "hello@mail.we-met.link" },
      fromDisplayName: "We Met",
      sendEmail,
      logMalformedLeadSink: vi.fn(),
    });

    await handler.deliverOwnerEmail(
      {
        type: "lead_sink_owner_email",
        sinkId: "sink-1",
        sinkKind: "email",
        sinkConfig: { to: "owner@example.com" },
        lead: {
          leadId: "lead-1",
          submittedAt: "2026-10-12T12:00:00.000Z",
          environment: "production",
          isTestLead: false,
          name: "Sam Rivera",
          email: "visitor@example.com",
          phone: null,
        },
        details: {
          phone: "+1 555 0100",
          jobTitle: "Founder",
          company: null,
          note: null,
        },
        cardId: "card-1",
        cardSlug: "demo",
        sourceUrl: "https://we-met.link/hi/demo",
      },
      { messageAttempts: 1, visitorEmailMode: "owner_relay" },
    );

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const outbound = sendEmail.mock.calls[0]![0]! as OutboundEmail;
    expect(outbound.to).toBe("owner@example.com");
    expect(outbound.replyTo).toBe("visitor@example.com");
    expect(outbound.subject).toBe("You met Sam Rivera");
    expect(outbound.inReplyTo).toBeUndefined();
    expect(outbound.references).toBeUndefined();
    expect(outbound.textPlain).toContain("Hit Reply to write back");
  });

  it("uses the new-lead template for direct mode without threading headers", async () => {
    const sendEmail = vi.fn(async (_message: OutboundEmail) => ({
      messageId: "msg-2",
      threadId: null,
    }));
    const handler = createEmailLeadSinkHandler({
      weMetEnv: "production",
      outboundFrom: { cloudflareFromEmail: "hello@mail.we-met.link" },
      fromDisplayName: "We Met",
      sendEmail,
      logMalformedLeadSink: vi.fn(),
    });

    await handler.deliverOwnerEmail(
      {
        type: "owner_email_due",
        sinkId: "sink-1",
        sinkKind: "email",
        sinkConfig: { to: "owner@example.com" },
        lead: {
          leadId: "lead-1",
          submittedAt: "2026-10-12T12:00:00.000Z",
          environment: "production",
          isTestLead: false,
          name: "Sam Rivera",
          email: "visitor@example.com",
          phone: null,
        },
        details: { phone: null, jobTitle: null, company: null, note: null },
        cardId: "card-1",
        cardSlug: "demo",
        sourceUrl: "https://we-met.link/hi/demo",
      },
      { messageAttempts: 1, visitorEmailMode: "direct" },
    );

    const outbound = sendEmail.mock.calls[0]![0]! as OutboundEmail;
    expect(outbound.subject).toBe("New lead added: Sam Rivera");
    expect(outbound.textPlain).toContain("New lead");
    expect(outbound.inReplyTo).toBeUndefined();
  });

  it("redirects Reply-To to the test inbox in non-prod", async () => {
    const sendEmail = vi.fn(async (_message: OutboundEmail) => ({
      messageId: "msg-3",
      threadId: null,
    }));
    const handler = createEmailLeadSinkHandler({
      weMetEnv: "preview",
      testMailTo: "test-inbox@example.com",
      outboundFrom: { cloudflareFromEmail: "hello@mail.we-met.link" },
      fromDisplayName: "We Met",
      sendEmail,
      logMalformedLeadSink: vi.fn(),
    });

    await handler.deliverOwnerEmail(
      {
        type: "lead_sink_owner_email",
        sinkId: "sink-1",
        sinkKind: "email",
        sinkConfig: { to: "owner@example.com" },
        lead: {
          leadId: "lead-1",
          submittedAt: "2026-10-12T12:00:00.000Z",
          environment: "preview",
          isTestLead: true,
          name: "Sam Rivera",
          email: "visitor@example.com",
          phone: null,
        },
        details: { phone: null, jobTitle: null, company: null, note: null },
        cardId: "card-1",
        cardSlug: "demo",
        sourceUrl: "https://we-met.link/hi/demo",
      },
      { messageAttempts: 1, visitorEmailMode: "owner_relay" },
    );

    const outbound = sendEmail.mock.calls[0]![0]! as OutboundEmail;
    expect(outbound.to).toBe("test-inbox@example.com");
    expect(outbound.replyTo).toBe("test-inbox@example.com");
    expect(outbound.subject).toContain("[we-met test → owner@example.com]");
  });
});
