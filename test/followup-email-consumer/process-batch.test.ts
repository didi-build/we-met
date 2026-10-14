import { describe, expect, it, vi } from "vitest";
import type { CardEmailSnapshot } from "@/exchange/types";
import {
  processFollowupQueueBatch,
  type FollowupConsumerDeps,
  type FollowupQueueMessage,
} from "@/followup-email-consumer/process-batch";

const card: CardEmailSnapshot = {
  slug: "demo",
  displayName: "Demo",
  email: "owner@example.com",
  photoKey: "photos/demo.jpg",
  contact: {
    name: { full: "Demo User", family: "User", given: "Demo", nickname: "Demo" },
    org: "Co",
    title: "Role",
    email: "owner@example.com",
    phone: "+1",
    vcardNote: "note",
    urls: [],
  },
  links: { bookingUrl: "https://example.com/book", footer: [] },
  pageCopy: { emailFromName: "Demo at Example" },
  copy: {
    followUpEmail: {
      subjectTemplate: "Hello {firstName}",
      greetingTemplate: "Hi {firstName}",
      bodyParagraphs: ["One"],
      attachmentLine: "Attached",
      bookCtaLabel: "Book",
      closingLine: "Bye",
    },
  },
};

function visitorBody(overrides: Record<string, unknown> = {}) {
  return {
    type: "visitor_followup",
    lead: {
      leadId: "lead-1",
      submittedAt: "2026-10-12T00:00:00.000Z",
      environment: "preview",
      isTestLead: true,
      name: "Alex Visitor",
      email: "visitor@example.com",
      phone: null,
    },
    card,
    ...overrides,
  };
}

function createMessage(
  body: unknown,
  overrides: Partial<FollowupQueueMessage> = {},
): FollowupQueueMessage {
  return {
    id: "msg-1",
    attempts: 1,
    body,
    ack: vi.fn(),
    retry: vi.fn(),
    ...overrides,
  };
}

function createDeps(
  overrides: Partial<FollowupConsumerDeps> = {},
): FollowupConsumerDeps {
  return {
    weMetEnv: "preview",
    baseUrl: "https://we-met.link",
    gmailSender: "sender@example.com",
    testMailTo: "test-inbox@example.com",
    emailSender: { send: vi.fn(async () => {}) },
    assets: {
      get: vi.fn(async () => ({
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([0xff, 0xd8, 0xff]));
            controller.close();
          },
        }),
        contentType: "image/jpeg",
      })),
    },
    logVisitorFollowupPermanentFailure: vi.fn(),
    logMalformedVisitorFollowup: vi.fn(),
    logUnsupportedType: vi.fn(),
    logMissingPhoto: vi.fn(),
    logNonJpegPhoto: vi.fn(),
    ...overrides,
  };
}

describe("processFollowupQueueBatch (unit)", () => {
  it("acks after successful visitor follow-up", async () => {
    const message = createMessage(visitorBody());
    const deps = createDeps();

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(deps.emailSender.send).toHaveBeenCalledOnce();
    const sent = vi.mocked(deps.emailSender.send).mock.calls[0][0];
    expect(sent.to).toBe("test-inbox@example.com");
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
  });

  it("retries on temporary visitor follow-up failure", async () => {
    const message = createMessage(visitorBody(), { attempts: 2 });
    const deps = createDeps({
      emailSender: {
        send: vi.fn(async () => {
          throw new Error("gmail_down");
        }),
      },
    });

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(message.retry).toHaveBeenCalledOnce();
    expect(message.ack).not.toHaveBeenCalled();
  });

  it("logs and acks after max visitor follow-up attempts", async () => {
    const message = createMessage(visitorBody(), { attempts: 5 });
    const deps = createDeps({
      emailSender: {
        send: vi.fn(async () => {
          throw new Error("gmail_down");
        }),
      },
    });

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(deps.logVisitorFollowupPermanentFailure).toHaveBeenCalledWith(
      "lead-1",
      "Error",
    );
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
  });

  it("acks malformed visitor_followup messages", async () => {
    const message = createMessage({
      type: "visitor_followup",
      lead: { leadId: "lead-x" },
    });
    const deps = createDeps();

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(deps.logMalformedVisitorFollowup).toHaveBeenCalledWith("lead-x");
    expect(message.ack).toHaveBeenCalledOnce();
  });

  it("retries lead_sink_record without acking", async () => {
    const message = createMessage({
      type: "lead_sink_record",
      sinkId: "s1",
      sinkKind: "email",
      sinkConfig: {},
      lead: visitorBody().lead,
      cardId: "c1",
      cardSlug: "demo",
    });
    const deps = createDeps();

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(deps.logUnsupportedType).toHaveBeenCalledWith("lead_sink_record");
    expect(message.retry).toHaveBeenCalledOnce();
    expect(message.ack).not.toHaveBeenCalled();
  });

  it("retries unknown queue types", async () => {
    const message = createMessage({ type: "something_else" });
    const deps = createDeps();

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(deps.logUnsupportedType).toHaveBeenCalledWith("something_else");
    expect(message.retry).toHaveBeenCalledOnce();
    expect(message.ack).not.toHaveBeenCalled();
  });

  it("does not block sibling messages in a batch", async () => {
    const good = createMessage(visitorBody(), { id: "good" });
    const bad = createMessage({ type: "lead_sink_append_details", sinkId: "s" });
    const deps = createDeps();

    await processFollowupQueueBatch({ messages: [good, bad] }, deps);

    expect(good.ack).toHaveBeenCalledOnce();
    expect(bad.retry).toHaveBeenCalledOnce();
  });
});
