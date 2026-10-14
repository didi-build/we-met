import { describe, expect, it, vi } from "vitest";
import type { CardEmailSnapshot } from "@/exchange/types";
import { FollowupEmailError } from "@/email/followup-email-error";
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
    logVisitorFollowupAttemptFailure: vi.fn(),
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

  it("retries on temporary visitor follow-up failure and logs attempt", async () => {
    const message = createMessage(visitorBody(), { attempts: 2 });
    const deps = createDeps({
      emailSender: {
        send: vi.fn(async () => {
          throw new FollowupEmailError("gmail_network_error");
        }),
      },
    });

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(deps.logVisitorFollowupAttemptFailure).toHaveBeenCalledWith(
      "lead-1",
      2,
      "gmail_network_error",
      true,
    );
    expect(message.retry).toHaveBeenCalledOnce();
    expect(message.ack).not.toHaveBeenCalled();
  });

  it("logs and acks after max visitor follow-up attempts", async () => {
    const message = createMessage(visitorBody(), { attempts: 5 });
    const deps = createDeps({
      emailSender: {
        send: vi.fn(async () => {
          throw new FollowupEmailError("gmail_network_error");
        }),
      },
    });

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(deps.logVisitorFollowupAttemptFailure).toHaveBeenCalledWith(
      "lead-1",
      5,
      "gmail_network_error",
      false,
    );
    expect(deps.logVisitorFollowupPermanentFailure).toHaveBeenCalledWith(
      "lead-1",
      "gmail_network_error",
    );
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
  });

  it("never calls send when non-prod redirect is unset; retries then permanent failure", async () => {
    const send = vi.fn(async () => {});
    const depsUnset = createDeps({ testMailTo: undefined, emailSender: { send } });
    const msgRetry = createMessage(visitorBody(), { attempts: 3 });
    await processFollowupQueueBatch({ messages: [msgRetry] }, depsUnset);
    expect(send).not.toHaveBeenCalled();
    expect(msgRetry.retry).toHaveBeenCalledOnce();
    expect(depsUnset.logVisitorFollowupAttemptFailure).toHaveBeenCalledWith(
      "lead-1",
      3,
      "nonprod_mail_redirect_unset",
      true,
    );

    const msgFinal = createMessage(visitorBody(), { attempts: 5 });
    const depsFinal = createDeps({ testMailTo: "", emailSender: { send } });
    await processFollowupQueueBatch({ messages: [msgFinal] }, depsFinal);
    expect(send).not.toHaveBeenCalled();
    expect(msgFinal.ack).toHaveBeenCalledOnce();
    expect(depsFinal.logVisitorFollowupPermanentFailure).toHaveBeenCalledWith(
      "lead-1",
      "nonprod_mail_redirect_unset",
    );
  });

  it("redirects when lead.environment is production but consumer WE_MET_ENV is preview", async () => {
    const message = createMessage(
      visitorBody({
        lead: {
          ...visitorBody().lead,
          environment: "production",
          isTestLead: false,
        },
      }),
    );
    const deps = createDeps({ weMetEnv: "preview" });
    await processFollowupQueueBatch({ messages: [message] }, deps);
    const sent = vi.mocked(deps.emailSender.send).mock.calls[0][0];
    expect(sent.to).toBe("test-inbox@example.com");
    expect(sent.subject).toContain("visitor@example.com");
  });

  it("production consumer sends to visitor without test label in subject", async () => {
    const message = createMessage(visitorBody());
    const deps = createDeps({ weMetEnv: "production", testMailTo: undefined });
    await processFollowupQueueBatch({ messages: [message] }, deps);
    const sent = vi.mocked(deps.emailSender.send).mock.calls[0][0];
    expect(sent.to).toBe("visitor@example.com");
    expect(sent.subject).not.toContain("[we-met test");
    expect(sent.textPlain).not.toContain("Test delivery (visitor typed)");
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
