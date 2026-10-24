import { describe, expect, it, vi } from "vitest";
import * as formatOwnerLeadEmail from "@/email/format-owner-lead-email";
import { createEmailLeadSinkHandler } from "@/followup-email-consumer/lead-sink/email-handler";
import type { ParsedLeadSinkAppendMessage } from "@/followup-email-consumer/lead-sink/types";

describe("createEmailLeadSinkHandler deliverAppend (unit)", () => {
  it("passes details.phone into buildOwnerLeadAppendEmail", async () => {
    const buildSpy = vi.spyOn(formatOwnerLeadEmail, "buildOwnerLeadAppendEmail");
    const sendEmail = vi.fn(async () => ({ messageId: "msg-1", threadId: null }));

    const handler = createEmailLeadSinkHandler({
      weMetEnv: "production",
      outboundFrom: { cloudflareFromEmail: "hello@mail.we-met.link" },
      fromDisplayName: "We Met",
      sendEmail,
      logMalformedLeadSink: vi.fn(),
    });

    const message: ParsedLeadSinkAppendMessage = {
      type: "lead_sink_append_details",
      sinkId: "sink-1",
      sinkKind: "email",
      sinkConfig: { to: "owner@example.com" },
      lead: {
        leadId: "lead-1",
        name: "Alex Visitor",
        email: "visitor@example.com",
      },
      details: {
        phone: "+1 555 0102",
        jobTitle: "Engineer",
        company: null,
        note: null,
      },
      detailsSubmittedAt: "2026-10-12T01:00:00.000Z",
      cardId: "card-1",
      cardSlug: "demo",
      sourceUrl: "https://we-met.link/hi/demo",
    };

    await handler.deliverAppend(message, {
      messageAttempts: 1,
      visitorEmailMode: "owner_relay",
      recordRef: null,
    });

    expect(buildSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "+1 555 0102",
        jobTitle: "Engineer",
      }),
    );
    buildSpy.mockRestore();
  });
});
