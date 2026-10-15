import { describe, expect, it, vi } from "vitest";
import type { CardEmailSnapshot } from "@/exchange/types";
import { FollowupEmailError } from "@/email/followup-email-error";
import {
  followupEmailRetryDelaySeconds,
  MAX_VISITOR_FOLLOWUP_ATTEMPTS,
} from "@/followup-email-consumer/retry";
import { followupRetryWindowSecondsThroughAttempt } from "../../scripts/lib/queue-retry-policy.mjs";
import { createEmailLeadSinkHandler } from "@/followup-email-consumer/lead-sink/email-handler";
import { createLeadSinkHandlerRegistry } from "@/followup-email-consumer/lead-sink/registry";
import {
  processFollowupQueueBatch,
  type FollowupConsumerDeps,
  type FollowupQueueMessage,
} from "@/followup-email-consumer/process-batch";
import { MemoryConsumerLeadDeliveryLedger } from "../followup-email-consumer/memory-consumer-ledger";

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
  ledger = new MemoryConsumerLeadDeliveryLedger(),
): FollowupConsumerDeps {
  const emailSender = overrides.emailSender ?? {
    send: vi.fn(async () => ({ messageId: "g1", threadId: "t1" })),
  };
  const now = overrides.now ?? (() => new Date("2026-10-12T12:00:00.000Z"));
  const logLedgerRowMissing = vi.fn();
  const logLedgerUpdateFailed = vi.fn();
  const sinkHandlers =
    overrides.sinkHandlers ??
    createLeadSinkHandlerRegistry({
      email: createEmailLeadSinkHandler({
        weMetEnv: overrides.weMetEnv ?? "preview",
        testMailTo: overrides.testMailTo ?? "test-inbox@example.com",
        ownerFromEmail: overrides.ownerFromEmail ?? "hello@we-met.link",
        emailSender,
        ledger,
        logLedgerRowMissing,
        logLedgerUpdateFailed,
        now,
      }),
    });

  return {
    weMetEnv: "preview",
    testMailTo: "test-inbox@example.com",
    ownerFromEmail: "hello@we-met.link",
    emailSender,
    ledger,
    sinkHandlers,
    logLedgerRowMissing,
    logLedgerUpdateFailed,
    logLeadSinkAttemptFailure: vi.fn(),
    logLeadSinkPermanentFailure: vi.fn(),
    logMalformedLeadSink: vi.fn(),
    now,
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

function sinkRecordBody(overrides: Record<string, unknown> = {}) {
  return {
    type: "lead_sink_record",
    sinkId: "sink-1",
    sinkKind: "email",
    sinkConfig: { to: "owner@example.com" },
    lead: visitorBody().lead,
    cardId: "card-1",
    cardSlug: "demo",
    sourceUrl: "https://we-met.link/hi/demo",
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
    expect(sent.from).toBe("hello@we-met.link");
    expect(sent.fromDisplayName).toBe("Demo at Example");
    expect(sent.replyTo).toBe("owner@example.com");
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
      { code: "gmail_network_error" },
      true,
    );
    expect(message.retry).toHaveBeenCalledOnce();
    expect(message.ack).not.toHaveBeenCalled();
    expect(message.retry).toHaveBeenCalledWith({
      delaySeconds: followupEmailRetryDelaySeconds(2),
    });
  });

  it("schedules the expected retry delay for attempts 1 through 29", async () => {
    const expectedFirstEight = [30, 60, 120, 240, 480, 960, 1800, 1800];
    for (let attempt = 1; attempt <= 29; attempt++) {
      const message = createMessage(visitorBody(), { attempts: attempt });
      const deps = createDeps({
        emailSender: {
          send: vi.fn(async () => {
            throw new FollowupEmailError("gmail_network_error");
          }),
        },
      });
      await processFollowupQueueBatch({ messages: [message] }, deps);
      if (attempt < MAX_VISITOR_FOLLOWUP_ATTEMPTS) {
        expect(message.retry).toHaveBeenCalledWith({
          delaySeconds: followupEmailRetryDelaySeconds(attempt),
        });
      }
      if (attempt <= expectedFirstEight.length) {
        expect(followupEmailRetryDelaySeconds(attempt)).toBe(
          expectedFirstEight[attempt - 1],
        );
      }
    }
    expect(followupRetryWindowSecondsThroughAttempt(29)).toBe(43_290);
  });

  it("logs and acks after max visitor follow-up attempts", async () => {
    const message = createMessage(visitorBody(), {
      attempts: MAX_VISITOR_FOLLOWUP_ATTEMPTS,
    });
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
      MAX_VISITOR_FOLLOWUP_ATTEMPTS,
      { code: "gmail_network_error" },
      false,
    );
    expect(deps.logVisitorFollowupPermanentFailure).toHaveBeenCalledWith("lead-1", {
      code: "gmail_network_error",
    });
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
  });

  it("never calls send when WE_MET_OWNER_FROM_EMAIL is unset; retries then permanent failure", async () => {
    const send = vi.fn(async () => ({ messageId: null, threadId: null }));
    const depsUnset = createDeps({ ownerFromEmail: undefined, emailSender: { send } });
    const msgRetry = createMessage(visitorBody(), { attempts: 3 });
    await processFollowupQueueBatch({ messages: [msgRetry] }, depsUnset);
    expect(send).not.toHaveBeenCalled();
    expect(msgRetry.retry).toHaveBeenCalledOnce();
    expect(depsUnset.logVisitorFollowupAttemptFailure).toHaveBeenCalledWith(
      "lead-1",
      3,
      { code: "owner_from_email_missing", secretName: "WE_MET_OWNER_FROM_EMAIL" },
      true,
    );

    const msgFinal = createMessage(visitorBody(), {
      attempts: MAX_VISITOR_FOLLOWUP_ATTEMPTS,
    });
    const depsFinal = createDeps({ ownerFromEmail: "", emailSender: { send } });
    await processFollowupQueueBatch({ messages: [msgFinal] }, depsFinal);
    expect(send).not.toHaveBeenCalled();
    expect(msgFinal.ack).toHaveBeenCalledOnce();
    expect(depsFinal.logVisitorFollowupPermanentFailure).toHaveBeenCalledWith(
      "lead-1",
      { code: "owner_from_email_missing", secretName: "WE_MET_OWNER_FROM_EMAIL" },
    );
  });

  it("never calls send when non-prod redirect is unset; retries then permanent failure", async () => {
    const send = vi.fn(async () => ({ messageId: null, threadId: null }));
    const depsUnset = createDeps({ testMailTo: undefined, emailSender: { send } });
    const msgRetry = createMessage(visitorBody(), { attempts: 3 });
    await processFollowupQueueBatch({ messages: [msgRetry] }, depsUnset);
    expect(send).not.toHaveBeenCalled();
    expect(msgRetry.retry).toHaveBeenCalledOnce();
    expect(depsUnset.logVisitorFollowupAttemptFailure).toHaveBeenCalledWith(
      "lead-1",
      3,
      { code: "nonprod_mail_redirect_unset" },
      true,
    );

    const msgFinal = createMessage(visitorBody(), {
      attempts: MAX_VISITOR_FOLLOWUP_ATTEMPTS,
    });
    const depsFinal = createDeps({ testMailTo: "", emailSender: { send } });
    await processFollowupQueueBatch({ messages: [msgFinal] }, depsFinal);
    expect(send).not.toHaveBeenCalled();
    expect(msgFinal.ack).toHaveBeenCalledOnce();
    expect(depsFinal.logVisitorFollowupPermanentFailure).toHaveBeenCalledWith(
      "lead-1",
      { code: "nonprod_mail_redirect_unset" },
    );
  });

  it("production mode acks malformed comma-separated visitor email without sending", async () => {
    const send = vi.fn(async () => ({ messageId: null, threadId: null }));
    const message = createMessage(
      visitorBody({
        lead: {
          ...visitorBody().lead,
          email: "visitor@example.com, attacker@evil.com",
        },
      }),
    );
    const deps = createDeps({
      weMetEnv: "production",
      testMailTo: undefined,
      emailSender: { send },
    });

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(send).not.toHaveBeenCalled();
    expect(deps.logMalformedVisitorFollowup).toHaveBeenCalledWith("lead-1");
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
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

  it("acks lead_sink_record without sending when ledger row is already sent", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedSent("lead-1", "sink-1", "record");
    const message = createMessage(sinkRecordBody());
    const send = vi.fn(async () => ({ messageId: "g1", threadId: "t1" }));
    const deps = createDeps({ emailSender: { send } }, ledger);

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(send).not.toHaveBeenCalled();
    expect(message.ack).toHaveBeenCalledOnce();
  });

  it("threads lead_sink_append_details when record email was sent", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedSent("lead-1", "sink-1", "record", "gmail-thread-record");
    ledger.seedQueued("lead-1", "sink-1", "append");
    const message = createMessage({
      type: "lead_sink_append_details",
      sinkId: "sink-1",
      sinkKind: "email",
      sinkConfig: { to: "owner@example.com" },
      lead: {
        leadId: "lead-1",
        name: "Alex Visitor",
        email: "visitor@example.com",
      },
      details: { jobTitle: "CEO", company: null, note: null },
      detailsSubmittedAt: "2026-10-12T01:00:00.000Z",
      cardId: "card-1",
      cardSlug: "demo",
      sourceUrl: "https://we-met.link/hi/demo",
    });
    const deps = createDeps({}, ledger);

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(deps.emailSender.send).toHaveBeenCalledOnce();
    const sent = vi.mocked(deps.emailSender.send).mock.calls[0][0];
    expect(sent.subject).toBe(
      "Re: [we-met test → owner@example.com] New lead added: Alex Visitor",
    );
    expect(sent.inReplyTo).toBe("<lead-1.sink-1.record@we-met.link>");
    expect(sent.references).toBe("<lead-1.sink-1.record@we-met.link>");
    expect(sent.threadId).toBe("gmail-thread-record");
    expect(message.ack).toHaveBeenCalledOnce();
  });

  it("acks lead_sink_record after successful owner email send", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "record");
    const message = createMessage(sinkRecordBody());
    const deps = createDeps({}, ledger);

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(deps.emailSender.send).toHaveBeenCalledOnce();
    const sent = vi.mocked(deps.emailSender.send).mock.calls[0][0];
    expect(sent.to).toBe("test-inbox@example.com");
    expect(sent.from).toBe("hello@we-met.link");
    expect(sent.fromDisplayName).toBe("We Met");
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
  });

  it("retries unsupported sink kinds without acking", async () => {
    const message = createMessage({
      ...sinkRecordBody(),
      sinkKind: "linear",
    });
    const deps = createDeps();

    await processFollowupQueueBatch({ messages: [message] }, deps);

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
    const bad = createMessage({ ...sinkRecordBody(), sinkKind: "linear" });
    const deps = createDeps();

    await processFollowupQueueBatch({ messages: [good, bad] }, deps);

    expect(good.ack).toHaveBeenCalledOnce();
    expect(bad.retry).toHaveBeenCalledOnce();
  });
});
