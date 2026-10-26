import { describe, expect, it, vi } from "vitest";
import type { CardEmailSnapshot } from "@/exchange/types";
import { createConsumerOutboundEmailSend } from "@/email/email-provider";
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
import {
  defaultLeadEmailControls,
  leadEmailConsumerEnabled,
} from "../helpers/lead-email-deps";
import { MemoryExchangeOwnerEmailStore } from "@/exchange-owner-email/memory-store";

const card: CardEmailSnapshot = {
  slug: "demo",
  displayName: "Demo",
  email: "owner@example.com",
  photoKey: "photos/demo.jpg",
  contact: {
    name: { full: "Demo User", family: "User", given: "Demo", nickname: "Demo" },
    org: "Co",
    title: "Role",
    phone: "+1",
    vcardNote: "note",
    urls: [],
  },
  pageCopy: { emailFromName: "Demo at Example" },
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

const PLATFORM_FROM_DISPLAY_NAME = "Diadem at We Met";

function defaultVisitorLetterExchangeStore(): MemoryExchangeOwnerEmailStore {
  const store = new MemoryExchangeOwnerEmailStore();
  store.rows.set("lead-1", {
    leadId: "lead-1",
    cardId: "card-1",
    triggeredAt: null,
    ownerEmailClaimedAt: null,
    ownerEmailSentAt: null,
    visitorLetterClaimedAt: null,
    visitorLetterSentAt: null,
    createdAt: "2026-10-12T12:00:00.000Z",
    updatedAt: "2026-10-12T12:00:00.000Z",
  });
  return store;
}

const CLOUDFLARE_EMAIL_ADDRESS_NAME_TYPE_ERROR =
  "Incorrect type for the 'name' field on 'EmailAddress': the provided value is not of type 'string'.";

function createCloudflareBindingSendEmailThatThrowsNameTypeError(): {
  emailSend: ReturnType<typeof vi.fn>;
  sendEmail: ReturnType<typeof createConsumerOutboundEmailSend>;
} {
  const emailSend = vi.fn(async () => {
    throw new Error(CLOUDFLARE_EMAIL_ADDRESS_NAME_TYPE_ERROR);
  });
  const sendEmail = createConsumerOutboundEmailSend({
    EMAIL: { send: emailSend },
  });
  return { emailSend, sendEmail };
}

function createDeps(
  overrides: Partial<FollowupConsumerDeps> = {},
  ledgerArg?: MemoryConsumerLeadDeliveryLedger,
): FollowupConsumerDeps {
  const ledger =
    overrides.ledger ?? ledgerArg ?? new MemoryConsumerLeadDeliveryLedger();
  const sendEmail =
    overrides.sendEmail ?? vi.fn(async () => ({ messageId: "g1", threadId: "t1" }));
  const outboundFrom = overrides.outboundFrom ?? {
    cloudflareFromEmail: "hello@mail.we-met.link",
  };
  const now = overrides.now ?? (() => new Date("2026-10-12T12:00:00.000Z"));
  const weMetEnv = overrides.weMetEnv ?? "preview";
  const testMailTo =
    "testMailTo" in overrides ? overrides.testMailTo : "test-inbox@example.com";
  const fromDisplayName =
    "fromDisplayName" in overrides
      ? overrides.fromDisplayName
      : PLATFORM_FROM_DISPLAY_NAME;
  const logLedgerRowMissing = vi.fn();
  const logLedgerUpdateFailed = vi.fn();
  const logMalformedLeadSinkForHandler = vi.fn();
  const sinkHandlers =
    overrides.sinkHandlers ??
    createLeadSinkHandlerRegistry({
      email: createEmailLeadSinkHandler({
        weMetEnv,
        testMailTo,
        outboundFrom,
        fromDisplayName,
        sendEmail,
        logMalformedLeadSink: logMalformedLeadSinkForHandler,
      }),
    });

  return {
    ...leadEmailConsumerEnabled,
    weMetEnv,
    baseUrl: overrides.baseUrl ?? "https://we-met.link",
    testMailTo,
    outboundFrom,
    fromDisplayName,
    sendEmail,
    ledger,
    sinkHandlers,
    logLedgerRowMissing,
    logLedgerUpdateFailed,
    logLeadSinkAppendDeferred: vi.fn(),
    logExchangeOwnerEmailRowMissing: vi.fn(),
    logExchangeOwnerEmailConfirmFailed: vi.fn(),
    exchangeOwnerEmail:
      overrides.exchangeOwnerEmail ?? defaultVisitorLetterExchangeStore(),
    logLeadSinkLedgerRecordFailed: vi.fn(),
    logLeadSinkLedgerMarkFailed: vi.fn(),
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
    logVisitorFollowupDroppedPaused: vi.fn(),
    logExchangeVisitorLetterRowMissing: vi.fn(),
    logExchangeVisitorLetterConfirmFailed: vi.fn(),
    logExchangeVisitorLetterContentionExhausted: vi.fn(),
    logExchangeVisitorLetterSkippedPriorSend: vi.fn(),
    logExchangeOwnerEmailContentionExhausted: vi.fn(),
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

    expect(deps.sendEmail).toHaveBeenCalledOnce();
    const sent = vi.mocked(deps.sendEmail).mock.calls[0][0];
    expect(sent.to).toBe("test-inbox@example.com");
    expect(sent.from).toBe("hello@mail.we-met.link");
    expect(sent.fromDisplayName).toBe("Demo via We Met");
    expect(sent.replyTo).toBe("owner@example.com");
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
  });

  it("retries on temporary visitor follow-up failure and logs attempt", async () => {
    const message = createMessage(visitorBody(), { attempts: 2 });
    const deps = createDeps({
      sendEmail: vi.fn(async () => {
        throw new FollowupEmailError("cloudflare_E_RATE_LIMIT_EXCEEDED");
      }),
    });

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(deps.logVisitorFollowupAttemptFailure).toHaveBeenCalledWith(
      "lead-1",
      2,
      { code: "cloudflare_E_RATE_LIMIT_EXCEEDED" },
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
        sendEmail: vi.fn(async () => {
          throw new FollowupEmailError("cloudflare_E_RATE_LIMIT_EXCEEDED");
        }),
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
      sendEmail: vi.fn(async () => {
        throw new FollowupEmailError("cloudflare_E_RATE_LIMIT_EXCEEDED");
      }),
    });

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(deps.logVisitorFollowupAttemptFailure).toHaveBeenCalledWith(
      "lead-1",
      MAX_VISITOR_FOLLOWUP_ATTEMPTS,
      { code: "cloudflare_E_RATE_LIMIT_EXCEEDED" },
      false,
    );
    expect(deps.logVisitorFollowupPermanentFailure).toHaveBeenCalledWith("lead-1", {
      code: "cloudflare_E_RATE_LIMIT_EXCEEDED",
    });
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
  });

  it("uses platform From display name when the owner given name is unsafe", async () => {
    const unsafeCard: CardEmailSnapshot = {
      ...card,
      contact: {
        ...card.contact,
        name: { full: "R2D2 Bot", family: "Bot", given: "R2D2", nickname: "" },
      },
    };
    const message = createMessage(visitorBody({ card: unsafeCard }));
    const deps = createDeps();

    await processFollowupQueueBatch({ messages: [message] }, deps);

    const sent = vi.mocked(deps.sendEmail).mock.calls[0][0];
    expect(sent.fromDisplayName).toBe(PLATFORM_FROM_DISPLAY_NAME);
    expect(sent.replyTo).toBe("owner@example.com");
  });

  it("never calls send when WE_MET_FROM_DISPLAY_NAME is unset; retries then permanent failure", async () => {
    const send = vi.fn(async () => ({ messageId: null, threadId: null }));
    const depsUnset = createDeps({ fromDisplayName: undefined, sendEmail: send });
    const msgRetry = createMessage(visitorBody(), { attempts: 3 });
    await processFollowupQueueBatch({ messages: [msgRetry] }, depsUnset);
    expect(send).not.toHaveBeenCalled();
    expect(msgRetry.retry).toHaveBeenCalledOnce();
    expect(depsUnset.logVisitorFollowupAttemptFailure).toHaveBeenCalledWith(
      "lead-1",
      3,
      { code: "from_display_name_missing", secretName: "WE_MET_FROM_DISPLAY_NAME" },
      true,
    );

    const msgFinal = createMessage(visitorBody(), {
      attempts: MAX_VISITOR_FOLLOWUP_ATTEMPTS,
    });
    const depsFinal = createDeps({ fromDisplayName: "", sendEmail: send });
    await processFollowupQueueBatch({ messages: [msgFinal] }, depsFinal);
    expect(send).not.toHaveBeenCalled();
    expect(msgFinal.ack).toHaveBeenCalledOnce();
    expect(depsFinal.logVisitorFollowupPermanentFailure).toHaveBeenCalledWith(
      "lead-1",
      { code: "from_display_name_missing", secretName: "WE_MET_FROM_DISPLAY_NAME" },
    );
  });

  it("never calls send when WE_MET_EMAIL_FROM_CLOUDFLARE is unset; retries then permanent failure", async () => {
    const send = vi.fn(async () => ({ messageId: null, threadId: null }));
    const depsUnset = createDeps({
      outboundFrom: {
        cloudflareFromEmail: undefined,
      },
      sendEmail: send,
    });
    const msgRetry = createMessage(visitorBody(), { attempts: 3 });
    await processFollowupQueueBatch({ messages: [msgRetry] }, depsUnset);
    expect(send).not.toHaveBeenCalled();
    expect(msgRetry.retry).toHaveBeenCalledOnce();
    expect(depsUnset.logVisitorFollowupAttemptFailure).toHaveBeenCalledWith(
      "lead-1",
      3,
      {
        code: "cloudflare_from_email_missing",
        secretName: "WE_MET_EMAIL_FROM_CLOUDFLARE",
      },
      true,
    );

    const msgFinal = createMessage(visitorBody(), {
      attempts: MAX_VISITOR_FOLLOWUP_ATTEMPTS,
    });
    const depsFinal = createDeps({
      outboundFrom: {
        cloudflareFromEmail: "",
      },
      sendEmail: send,
    });
    await processFollowupQueueBatch({ messages: [msgFinal] }, depsFinal);
    expect(send).not.toHaveBeenCalled();
    expect(msgFinal.ack).toHaveBeenCalledOnce();
    expect(depsFinal.logVisitorFollowupPermanentFailure).toHaveBeenCalledWith(
      "lead-1",
      {
        code: "cloudflare_from_email_missing",
        secretName: "WE_MET_EMAIL_FROM_CLOUDFLARE",
      },
    );
  });

  it("never calls send when non-prod redirect is unset; retries then permanent failure", async () => {
    const send = vi.fn(async () => ({ messageId: null, threadId: null }));
    const depsUnset = createDeps({ testMailTo: undefined, sendEmail: send });
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
    const depsFinal = createDeps({ testMailTo: "", sendEmail: send });
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
      sendEmail: send,
    });

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(send).not.toHaveBeenCalled();
    expect(deps.logMalformedVisitorFollowup).toHaveBeenCalledWith("lead-1");
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
  });

  it("staging consumer redirects visitor mail with test subject and delivery line", async () => {
    const message = createMessage(visitorBody());
    const deps = createDeps({ weMetEnv: "staging" });
    await processFollowupQueueBatch({ messages: [message] }, deps);
    const sent = vi.mocked(deps.sendEmail).mock.calls[0][0];
    expect(sent.to).toBe("test-inbox@example.com");
    expect(sent.subject).toContain("[we-met test → visitor@example.com]");
    expect(sent.textPlain).toContain(
      "Test delivery (sink destination): visitor@example.com",
    );
  });

  it("staging consumer redirects owner lead sink mail with test subject and delivery line", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "record");
    const message = createMessage(sinkRecordBody());
    const deps = createDeps({ weMetEnv: "staging" }, ledger);
    await processFollowupQueueBatch({ messages: [message] }, deps);
    const sent = vi.mocked(deps.sendEmail).mock.calls[0][0];
    expect(sent.to).toBe("test-inbox@example.com");
    expect(sent.subject).toContain("[we-met test → owner@example.com]");
    expect(sent.textPlain).toContain(
      "Test delivery (sink destination): owner@example.com",
    );
  });

  it("staging consumer redirects owner relay visitor mail with test subject and delivery line", async () => {
    const message = createMessage(visitorBody());
    const deps = createDeps({
      weMetEnv: "staging",
      readLeadEmailControls: vi.fn(async () => ({
        ...defaultLeadEmailControls,
        visitorEmailMode: "owner_relay" as const,
      })),
    });
    await processFollowupQueueBatch({ messages: [message] }, deps);
    const sent = vi.mocked(deps.sendEmail).mock.calls[0][0];
    expect(sent.to).toBe("test-inbox@example.com");
    expect(sent.subject).toContain("[we-met test → owner@example.com]");
    expect(sent.textPlain).toContain(
      "Test delivery (sink destination): owner@example.com",
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
    const sent = vi.mocked(deps.sendEmail).mock.calls[0][0];
    expect(sent.to).toBe("test-inbox@example.com");
    expect(sent.subject).toContain("visitor@example.com");
  });

  it("production consumer sends to visitor without test label in subject", async () => {
    const message = createMessage(visitorBody());
    const deps = createDeps({ weMetEnv: "production", testMailTo: undefined });
    await processFollowupQueueBatch({ messages: [message] }, deps);
    const sent = vi.mocked(deps.sendEmail).mock.calls[0][0];
    expect(sent.to).toBe("visitor@example.com");
    expect(sent.subject).not.toContain("[we-met test");
    expect(sent.textPlain).not.toContain("Test delivery (visitor typed)");
  });

  it("includes the contact card link only in owner_relay when a token is present", async () => {
    const message = createMessage(
      visitorBody({ relayContactCardToken: "relay-token-abc" }),
    );
    const deps = createDeps({
      readLeadEmailControls: vi.fn(async () => ({
        ...defaultLeadEmailControls,
        visitorEmailMode: "owner_relay" as const,
      })),
    });
    await processFollowupQueueBatch({ messages: [message] }, deps);
    const sent = vi.mocked(deps.sendEmail).mock.calls[0][0];
    expect(sent.textPlain).toMatch(/\/api\/exchange\/[^/\s]+\/contact-card\?token=/);
    expect(sent.textHtml).toContain("Save my contact card");
  });

  it("logs relay_letter_missing_contact_card_link in owner_relay without a token and still sends", async () => {
    const message = createMessage(visitorBody());
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const deps = createDeps({
      readLeadEmailControls: vi.fn(async () => ({
        ...defaultLeadEmailControls,
        visitorEmailMode: "owner_relay" as const,
      })),
    });
    await processFollowupQueueBatch({ messages: [message] }, deps);
    const relayLogs = errorSpy.mock.calls.filter(
      (call) => call[0] === "relay_letter_missing_contact_card_link",
    );
    expect(relayLogs).toHaveLength(1);
    expect(relayLogs[0]?.[1]).toEqual({ leadId: "lead-1", cardId: "card-1" });
    const serialized = JSON.stringify(errorSpy.mock.calls);
    expect(serialized).not.toContain("relay-token");
    expect(serialized).not.toContain("visitor@example.com");
    expect(vi.mocked(deps.sendEmail)).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });

  it("still sends when getSendState rejects during missing-link logging", async () => {
    const message = createMessage(visitorBody());
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const store = defaultVisitorLetterExchangeStore();
    const getSendState = vi
      .spyOn(store, "getSendState")
      .mockRejectedValue(new Error("d1 unavailable"));
    try {
      const deps = createDeps({
        exchangeOwnerEmail: store,
        readLeadEmailControls: vi.fn(async () => ({
          ...defaultLeadEmailControls,
          visitorEmailMode: "owner_relay" as const,
        })),
      });
      await processFollowupQueueBatch({ messages: [message] }, deps);
      expect(getSendState).toHaveBeenCalled();
      const relayLogs = errorSpy.mock.calls.filter(
        (call) => call[0] === "relay_letter_missing_contact_card_link",
      );
      expect(relayLogs).toHaveLength(1);
      expect(relayLogs[0]).toEqual([
        "relay_letter_missing_contact_card_link",
        { leadId: "lead-1" },
      ]);
      expect(message.ack).toHaveBeenCalledOnce();
      expect(message.retry).not.toHaveBeenCalled();
      expect(vi.mocked(deps.sendEmail)).toHaveBeenCalledOnce();
    } finally {
      getSendState.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it("logs relay_letter_missing_contact_card_link with leadId only when sendState is null", async () => {
    const message = createMessage(visitorBody());
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const store = defaultVisitorLetterExchangeStore();
    vi.spyOn(store, "getSendState").mockResolvedValue(null);
    const deps = createDeps({
      exchangeOwnerEmail: store,
      readLeadEmailControls: vi.fn(async () => ({
        ...defaultLeadEmailControls,
        visitorEmailMode: "owner_relay" as const,
      })),
    });
    await processFollowupQueueBatch({ messages: [message] }, deps);
    const relayLogs = errorSpy.mock.calls.filter(
      (call) => call[0] === "relay_letter_missing_contact_card_link",
    );
    expect(relayLogs).toHaveLength(1);
    expect(relayLogs[0]?.[1]).toEqual({ leadId: "lead-1" });
    expect(vi.mocked(deps.sendEmail)).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });

  it("does not log relay_letter_missing_contact_card_link in direct mode without a token", async () => {
    const message = createMessage(visitorBody());
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const deps = createDeps({
      readLeadEmailControls: vi.fn(async () => ({
        ...defaultLeadEmailControls,
        visitorEmailMode: "direct" as const,
      })),
    });
    await processFollowupQueueBatch({ messages: [message] }, deps);
    const relayLogs = errorSpy.mock.calls.filter(
      (call) => call[0] === "relay_letter_missing_contact_card_link",
    );
    expect(relayLogs).toHaveLength(0);
    expect(vi.mocked(deps.sendEmail)).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });

  it("omits the contact card link in direct mode even when the payload carries a token", async () => {
    const message = createMessage(
      visitorBody({ relayContactCardToken: "should-not-appear" }),
    );
    const deps = createDeps({
      readLeadEmailControls: vi.fn(async () => ({
        ...defaultLeadEmailControls,
        visitorEmailMode: "direct" as const,
      })),
    });
    await processFollowupQueueBatch({ messages: [message] }, deps);
    const sent = vi.mocked(deps.sendEmail).mock.calls[0][0];
    expect(sent.textPlain).not.toContain("contact-card");
    expect(sent.textHtml).not.toContain("Save my contact card");
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
    const deps = createDeps({ sendEmail: send }, ledger);

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(send).not.toHaveBeenCalled();
    expect(message.ack).toHaveBeenCalledOnce();
  });

  it("sends lead_sink_append_details unthreaded when record external_ref is Gmail-era", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedSent(
      "lead-1",
      "sink-1",
      "record",
      JSON.stringify({ gmailThreadId: "gmail-thread-record", gmailMessageId: "g1" }),
    );
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

    await expect(
      processFollowupQueueBatch({ messages: [message] }, deps),
    ).resolves.toBeUndefined();

    expect(deps.sendEmail).toHaveBeenCalledOnce();
    const sent = vi.mocked(deps.sendEmail).mock.calls[0][0];
    expect(sent.inReplyTo).toBeUndefined();
    expect(sent.references).toBeUndefined();
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
  });

  it("acks lead_sink_record after successful owner email send", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "record");
    const message = createMessage(sinkRecordBody());
    const deps = createDeps({}, ledger);

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(deps.sendEmail).toHaveBeenCalledOnce();
    const sent = vi.mocked(deps.sendEmail).mock.calls[0][0];
    expect(sent.to).toBe("test-inbox@example.com");
    expect(sent.from).toBe("hello@mail.we-met.link");
    expect(sent.fromDisplayName).toBe(PLATFORM_FROM_DISPLAY_NAME);
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
  });

  it("retries unsupported sink kinds without acking", async () => {
    const message = createMessage({
      ...sinkRecordBody(),
      sinkKind: "linear",
      sinkConfig: { apiKey: "secret" },
    });
    const deps = createDeps();

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(deps.logUnsupportedType).toHaveBeenCalledWith("linear");
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
    const bad = createMessage({
      ...sinkRecordBody(),
      sinkKind: "linear",
      sinkConfig: { apiKey: "secret" },
    });
    const deps = createDeps();

    await processFollowupQueueBatch({ messages: [good, bad] }, deps);

    expect(good.ack).toHaveBeenCalledOnce();
    expect(bad.retry).toHaveBeenCalledOnce();
  });

  it("sends legacy append immediately without waiting on record row", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "record");
    ledger.seedQueued("lead-1", "sink-1", "append");
    const message = createMessage(
      {
        type: "lead_sink_append_details",
        sinkId: "sink-1",
        sinkKind: "email",
        sinkConfig: { to: "owner@example.com" },
        lead: {
          leadId: "lead-1",
          name: "Alex Visitor",
          email: "visitor@example.com",
        },
        details: { phone: null, jobTitle: null, company: null, note: null },
        detailsSubmittedAt: "2026-10-12T01:00:00.000Z",
        cardId: "card-1",
        cardSlug: "demo",
        sourceUrl: "https://we-met.link/hi/demo",
      },
      { attempts: 2 },
    );
    const deps = createDeps({}, ledger);

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(deps.sendEmail).toHaveBeenCalledOnce();
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
  });

  it("sends append unthreaded when record row failed", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "record");
    await ledger.markFailed({
      leadId: "lead-1",
      sinkId: "sink-1",
      phase: "record",
      errorCode: "cloudflare_E_RATE_LIMIT_EXCEEDED",
      updatedAt: "2026-10-12T12:00:00.000Z",
    });
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
      details: { jobTitle: null, company: null, note: null },
      detailsSubmittedAt: "2026-10-12T01:00:00.000Z",
      cardId: "card-1",
      cardSlug: "demo",
      sourceUrl: "https://we-met.link/hi/demo",
    });
    const deps = createDeps({}, ledger);

    await processFollowupQueueBatch({ messages: [message] }, deps);

    const sent = vi.mocked(deps.sendEmail).mock.calls[0][0];
    expect(sent.inReplyTo).toBeUndefined();
    expect(message.ack).toHaveBeenCalledOnce();
  });

  it("retries transient sink failure with shared delay and records ledger attempt", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "record");
    const message = createMessage(sinkRecordBody(), { attempts: 2 });
    const deps = createDeps(
      {
        sendEmail: vi.fn(async () => {
          throw new FollowupEmailError("cloudflare_E_RATE_LIMIT_EXCEEDED");
        }),
      },
      ledger,
    );

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(message.retry).toHaveBeenCalledWith({
      delaySeconds: followupEmailRetryDelaySeconds(2),
    });
    const row = ledger.getRowState("lead-1", "sink-1", "record");
    expect(row?.attemptCount).toBe(2);
    expect(row?.nextAttemptAt).toBe("2026-10-12T12:01:00.000Z");
  });

  it("marks sink failed and acks on final attempt", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "record");
    const message = createMessage(sinkRecordBody(), {
      attempts: MAX_VISITOR_FOLLOWUP_ATTEMPTS,
    });
    const deps = createDeps(
      {
        sendEmail: vi.fn(async () => {
          throw new FollowupEmailError("cloudflare_E_RATE_LIMIT_EXCEEDED");
        }),
      },
      ledger,
    );

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
    const row = ledger.getRowState("lead-1", "sink-1", "record");
    expect(row?.status).toBe("failed");
    expect(row?.errorCode).toBe("cloudflare_E_RATE_LIMIT_EXCEEDED");
    expect(row?.nextAttemptAt).toBeNull();
  });

  it("never sends sink email when WE_MET_EMAIL_FROM_CLOUDFLARE is missing", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "record");
    const send = vi.fn(async () => ({ messageId: "g1", threadId: "t1" }));
    const message = createMessage(sinkRecordBody(), { attempts: 3 });
    const deps = createDeps(
      {
        outboundFrom: {
          cloudflareFromEmail: undefined,
        },
        sendEmail: send,
      },
      ledger,
    );

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(send).not.toHaveBeenCalled();
    expect(message.retry).toHaveBeenCalledOnce();
  });

  it("never sends sink email when WE_MET_FROM_DISPLAY_NAME is missing", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "record");
    const send = vi.fn(async () => ({ messageId: "g1", threadId: "t1" }));
    const message = createMessage(sinkRecordBody(), { attempts: 3 });
    const deps = createDeps({ fromDisplayName: undefined, sendEmail: send }, ledger);

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(send).not.toHaveBeenCalled();
    expect(message.retry).toHaveBeenCalledOnce();
    expect(deps.logLeadSinkAttemptFailure).toHaveBeenCalledWith(
      "lead-1",
      "sink-1",
      3,
      { code: "from_display_name_missing", secretName: "WE_MET_FROM_DISPLAY_NAME" },
      true,
    );
  });

  it("fails closed for sinks when non-prod redirect is unset", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "record");
    const send = vi.fn(async () => ({ messageId: "g1", threadId: "t1" }));
    const message = createMessage(sinkRecordBody(), { attempts: 3 });
    const deps = createDeps({ testMailTo: undefined, sendEmail: send }, ledger);

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(send).not.toHaveBeenCalled();
    expect(message.retry).toHaveBeenCalledOnce();
  });

  it("acks malformed sink message without retry", async () => {
    const message = createMessage({
      type: "lead_sink_record",
      sinkId: "sink-1",
      lead: { leadId: "lead-bad" },
    });
    const deps = createDeps();

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(deps.logMalformedLeadSink).toHaveBeenCalledWith("lead-bad");
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
  });

  it("acks when ledger row is missing without sending", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    const send = vi.fn(async () => ({ messageId: "g1", threadId: "t1" }));
    const message = createMessage(sinkRecordBody());
    const deps = createDeps({ sendEmail: send }, ledger);

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(send).not.toHaveBeenCalled();
    expect(deps.logLedgerRowMissing).toHaveBeenCalledWith("lead-1", "sink-1");
    expect(message.ack).toHaveBeenCalledOnce();
  });

  it("acks without retry when send succeeds but markSent throws", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "record");
    const markSent = vi.fn(async () => {
      throw new Error("db down");
    });
    const ledgerBroken = {
      ...ledger,
      markSent,
      findRow: ledger.findRow.bind(ledger),
      recordFailedAttempt: ledger.recordFailedAttempt.bind(ledger),
      markFailed: ledger.markFailed.bind(ledger),
    };
    const message = createMessage(sinkRecordBody());
    const deps = createDeps({ ledger: ledgerBroken });

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(deps.sendEmail).toHaveBeenCalledOnce();
    expect(deps.logLedgerUpdateFailed).toHaveBeenCalledWith(
      "lead-1",
      "sink-1",
      "ledger_update_failed",
    );
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
  });

  it("delivers two independent threads for two email sinks with the same to", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-a", "record");
    ledger.seedQueued("lead-1", "sink-b", "record");
    let sendCount = 0;
    const send = vi.fn(async () => {
      const index = sendCount++;
      return { messageId: `msg-${index}`, threadId: `thread-${index}` };
    });
    const deps = createDeps({ sendEmail: send }, ledger);
    const msgA = createMessage(sinkRecordBody({ sinkId: "sink-a" }), { id: "a" });
    const msgB = createMessage(sinkRecordBody({ sinkId: "sink-b" }), { id: "b" });

    await processFollowupQueueBatch({ messages: [msgA, msgB] }, deps);

    expect(send).toHaveBeenCalledTimes(2);
    expect(
      JSON.parse(ledger.getRowState("lead-1", "sink-a", "record")!.externalRef!),
    ).toEqual({ provider: "cloudflare", messageId: "msg-0" });
    expect(
      JSON.parse(ledger.getRowState("lead-1", "sink-b", "record")!.externalRef!),
    ).toEqual({ provider: "cloudflare", messageId: "msg-1" });
  });

  it("does not block visitor follow-up when email sink fails first in batch", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "record");
    const sink = createMessage(sinkRecordBody(), { id: "sink" });
    const visitor = createMessage(visitorBody(), { id: "visitor" });
    let sendCalls = 0;
    const send = vi.fn(async () => {
      sendCalls += 1;
      if (sendCalls === 1) {
        throw new FollowupEmailError("cloudflare_E_RATE_LIMIT_EXCEEDED");
      }
      return { messageId: "v1", threadId: null };
    });
    const deps = createDeps({ sendEmail: send }, ledger);

    await processFollowupQueueBatch({ messages: [sink, visitor] }, deps);

    expect(send).toHaveBeenCalledTimes(2);
    expect(sink.retry).toHaveBeenCalledOnce();
    expect(visitor.ack).toHaveBeenCalledOnce();
    expect(visitor.retry).not.toHaveBeenCalled();
  });

  it("delivers second email sink when the first sink fails in the same batch", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-a", "record");
    ledger.seedQueued("lead-1", "sink-b", "record");
    const sinkA = createMessage(sinkRecordBody({ sinkId: "sink-a" }), { id: "sink-a" });
    const sinkB = createMessage(sinkRecordBody({ sinkId: "sink-b" }), { id: "sink-b" });
    let sendCalls = 0;
    const send = vi.fn(async () => {
      sendCalls += 1;
      if (sendCalls === 1) {
        throw new FollowupEmailError("cloudflare_E_RATE_LIMIT_EXCEEDED");
      }
      return { messageId: "g-b", threadId: null };
    });
    const deps = createDeps({ sendEmail: send }, ledger);

    await processFollowupQueueBatch({ messages: [sinkA, sinkB] }, deps);

    expect(send).toHaveBeenCalledTimes(2);
    expect(sinkA.retry).toHaveBeenCalledOnce();
    expect(sinkB.ack).toHaveBeenCalledOnce();
    expect(ledger.getRowState("lead-1", "sink-b", "record")?.status).toBe("sent");
  });

  it("retries sink message when recordFailedAttempt throws", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "record");
    const recordFailedAttempt = vi.fn(async () => {
      throw new Error("db down");
    });
    const ledgerBroken = {
      ...ledger,
      recordFailedAttempt,
      findRow: ledger.findRow.bind(ledger),
      markSent: ledger.markSent.bind(ledger),
      markFailed: ledger.markFailed.bind(ledger),
    };
    const message = createMessage(sinkRecordBody(), { attempts: 2 });
    const deps = createDeps(
      {
        ledger: ledgerBroken,
        sendEmail: vi.fn(async () => {
          throw new FollowupEmailError("cloudflare_E_RATE_LIMIT_EXCEEDED");
        }),
      },
      ledger,
    );

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(message.retry).toHaveBeenCalledWith({
      delaySeconds: followupEmailRetryDelaySeconds(2),
    });
    expect(message.ack).not.toHaveBeenCalled();
    expect(deps.logLeadSinkLedgerRecordFailed).toHaveBeenCalledWith(
      "lead-1",
      "sink-1",
      "cloudflare_E_RATE_LIMIT_EXCEEDED",
    );
  });

  it("acks sink message on final attempt when markFailed throws", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "record");
    const markFailed = vi.fn(async () => {
      throw new Error("db down");
    });
    const ledgerBroken = {
      ...ledger,
      markFailed,
      findRow: ledger.findRow.bind(ledger),
      recordFailedAttempt: ledger.recordFailedAttempt.bind(ledger),
      markSent: ledger.markSent.bind(ledger),
    };
    const message = createMessage(sinkRecordBody(), {
      attempts: MAX_VISITOR_FOLLOWUP_ATTEMPTS,
    });
    const deps = createDeps(
      {
        ledger: ledgerBroken,
        sendEmail: vi.fn(async () => {
          throw new FollowupEmailError("cloudflare_E_RATE_LIMIT_EXCEEDED");
        }),
      },
      ledger,
    );

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
    expect(deps.logLeadSinkLedgerMarkFailed).toHaveBeenCalledWith(
      "lead-1",
      "sink-1",
      "cloudflare_E_RATE_LIMIT_EXCEEDED",
    );
  });

  it("acks invalid email sink config without retry", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "record");
    const send = vi.fn();
    const message = createMessage(
      sinkRecordBody({ sinkConfig: { to: "not-an-email" } }),
    );
    const deps = createDeps({ sendEmail: send }, ledger);

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(send).not.toHaveBeenCalled();
    expect(message.ack).toHaveBeenCalledOnce();
    expect(ledger.getRowState("lead-1", "sink-1", "record")?.errorCode).toBe(
      "malformed_sink_email_config",
    );
  });

  it("stores Cloudflare external_ref on owner record send with Cloudflare From and no Gmail threading fields", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "record");
    const message = createMessage(sinkRecordBody());
    const deps = createDeps(
      {
        sendEmail: vi.fn(async () => ({
          messageId: "<record@mail.we-met.link>",
          threadId: null,
        })),
      },
      ledger,
    );

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(deps.sendEmail).toHaveBeenCalledOnce();
    const sent = vi.mocked(deps.sendEmail).mock.calls[0]![0];
    expect(sent.from).toBe("hello@mail.we-met.link");
    expect(
      JSON.parse(ledger.getRowState("lead-1", "sink-1", "record")!.externalRef!),
    ).toEqual({
      provider: "cloudflare",
      messageId: "<record@mail.we-met.link>",
    });
    expect(message.ack).toHaveBeenCalledOnce();
  });

  it("sends Cloudflare append unthreaded when record ref is null", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedFailed("lead-1", "sink-1", "record", "cloudflare_E_RATE_LIMIT_EXCEEDED");
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

    const sent = vi.mocked(deps.sendEmail).mock.calls[0]![0];
    expect(sent.inReplyTo).toBeUndefined();
    expect(sent.references).toBeUndefined();
    expect(message.ack).toHaveBeenCalledOnce();
  });

  it("never calls send when Cloudflare From is malformed; visitor retries then permanent failure", async () => {
    const send = vi.fn();
    const depsRetry = createDeps({
      outboundFrom: {
        cloudflareFromEmail: "not an email",
      },
      sendEmail: send,
    });
    const msgRetry = createMessage(visitorBody(), { attempts: 3 });
    await processFollowupQueueBatch({ messages: [msgRetry] }, depsRetry);
    expect(send).not.toHaveBeenCalled();
    expect(msgRetry.retry).toHaveBeenCalledOnce();
    expect(depsRetry.logVisitorFollowupAttemptFailure).toHaveBeenCalledWith(
      "lead-1",
      3,
      {
        code: "cloudflare_from_email_missing",
        secretName: "WE_MET_EMAIL_FROM_CLOUDFLARE",
      },
      true,
    );

    const msgFinal = createMessage(visitorBody(), {
      attempts: MAX_VISITOR_FOLLOWUP_ATTEMPTS,
    });
    const depsFinal = createDeps({
      outboundFrom: {
        cloudflareFromEmail: "a@b.com, c@d.com",
      },
      sendEmail: send,
    });
    await processFollowupQueueBatch({ messages: [msgFinal] }, depsFinal);
    expect(send).not.toHaveBeenCalled();
    expect(msgFinal.ack).toHaveBeenCalledOnce();
    expect(depsFinal.logVisitorFollowupPermanentFailure).toHaveBeenCalledWith(
      "lead-1",
      {
        code: "cloudflare_from_email_missing",
        secretName: "WE_MET_EMAIL_FROM_CLOUDFLARE",
      },
    );
  });

  it("never calls send when Cloudflare From is unset; visitor retries then permanent failure", async () => {
    const send = vi.fn();
    const depsUnset = createDeps({
      outboundFrom: {
        cloudflareFromEmail: undefined,
      },
      sendEmail: send,
    });
    const msgRetry = createMessage(visitorBody(), { attempts: 3 });
    await processFollowupQueueBatch({ messages: [msgRetry] }, depsUnset);
    expect(send).not.toHaveBeenCalled();
    expect(msgRetry.retry).toHaveBeenCalledOnce();
    expect(depsUnset.logVisitorFollowupAttemptFailure).toHaveBeenCalledWith(
      "lead-1",
      3,
      {
        code: "cloudflare_from_email_missing",
        secretName: "WE_MET_EMAIL_FROM_CLOUDFLARE",
      },
      true,
    );

    const msgFinal = createMessage(visitorBody(), {
      attempts: MAX_VISITOR_FOLLOWUP_ATTEMPTS,
    });
    const depsFinal = createDeps({
      outboundFrom: { cloudflareFromEmail: "" },
      sendEmail: send,
    });
    await processFollowupQueueBatch({ messages: [msgFinal] }, depsFinal);
    expect(send).not.toHaveBeenCalled();
    expect(msgFinal.ack).toHaveBeenCalledOnce();
    expect(depsFinal.logVisitorFollowupPermanentFailure).toHaveBeenCalledWith(
      "lead-1",
      {
        code: "cloudflare_from_email_missing",
        secretName: "WE_MET_EMAIL_FROM_CLOUDFLARE",
      },
    );
  });

  it("never calls send when Cloudflare From is unset; sink retries then marks ledger failed", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "record");
    const send = vi.fn();
    const message = createMessage(sinkRecordBody(), { attempts: 3 });
    const deps = createDeps(
      {
        outboundFrom: {
          cloudflareFromEmail: undefined,
        },
        sendEmail: send,
      },
      ledger,
    );

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(send).not.toHaveBeenCalled();
    expect(message.retry).toHaveBeenCalledOnce();

    const finalMessage = createMessage(sinkRecordBody(), {
      attempts: MAX_VISITOR_FOLLOWUP_ATTEMPTS,
    });
    await processFollowupQueueBatch({ messages: [finalMessage] }, deps);
    expect(send).not.toHaveBeenCalled();
    expect(finalMessage.ack).toHaveBeenCalledOnce();
    expect(ledger.getRowState("lead-1", "sink-1", "record")?.status).toBe("failed");
    expect(ledger.getRowState("lead-1", "sink-1", "record")?.errorCode).toBe(
      "cloudflare_from_email_missing",
    );
  });

  it("marks sink failed without retry on permanent Cloudflare binding error", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "record");
    const message = createMessage(sinkRecordBody());
    const deps = createDeps(
      {
        sendEmail: vi.fn(async () => {
          throw new FollowupEmailError("cloudflare_E_CONTENT_TOO_LARGE");
        }),
      },
      ledger,
    );

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
    expect(ledger.getRowState("lead-1", "sink-1", "record")?.status).toBe("failed");
    expect(ledger.getRowState("lead-1", "sink-1", "record")?.errorCode).toBe(
      "cloudflare_E_CONTENT_TOO_LARGE",
    );
  });

  it("does not thread legacy lead_sink_append_details with record messageId", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedSent(
      "lead-1",
      "sink-1",
      "record",
      JSON.stringify({
        provider: "cloudflare",
        messageId: "<record@mail.we-met.link>",
      }),
    );
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
      details: { phone: null, jobTitle: "CEO", company: null, note: null },
      detailsSubmittedAt: "2026-10-12T01:00:00.000Z",
      cardId: "card-1",
      cardSlug: "demo",
      sourceUrl: "https://we-met.link/hi/demo",
    });
    const deps = createDeps({}, ledger);

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(deps.sendEmail).toHaveBeenCalledOnce();
    const sent = vi.mocked(deps.sendEmail).mock.calls[0]![0];
    expect(sent.from).toBe("hello@mail.we-met.link");
    expect(sent.inReplyTo).toBeUndefined();
    expect(sent.references).toBeUndefined();
    expect(message.ack).toHaveBeenCalledOnce();
  });

  it("acks visitor follow-up without retry when Cloudflare EMAIL.send rejects From name shape", async () => {
    const { emailSend, sendEmail } =
      createCloudflareBindingSendEmailThatThrowsNameTypeError();
    const message = createMessage(visitorBody(), { attempts: 2 });
    const deps = createDeps({
      sendEmail,
    });

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(emailSend).toHaveBeenCalledOnce();
    expect(deps.logVisitorFollowupPermanentFailure).toHaveBeenCalledWith("lead-1", {
      code: "cloudflare_send_validation_failed",
    });
    expect(deps.logVisitorFollowupAttemptFailure).not.toHaveBeenCalled();
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
  });

  it("acks lead sink record without retry when Cloudflare EMAIL.send rejects From name shape", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "record");
    const { emailSend, sendEmail } =
      createCloudflareBindingSendEmailThatThrowsNameTypeError();
    const message = createMessage(sinkRecordBody());
    const deps = createDeps(
      {
        sendEmail,
      },
      ledger,
    );

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(emailSend).toHaveBeenCalledOnce();
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
    expect(ledger.getRowState("lead-1", "sink-1", "record")?.status).toBe("failed");
    expect(ledger.getRowState("lead-1", "sink-1", "record")?.errorCode).toBe(
      "cloudflare_send_validation_failed",
    );
  });

  it("acks visitor follow-up on permanent Cloudflare recipient suppression", async () => {
    const message = createMessage(visitorBody(), { attempts: 2 });
    const deps = createDeps({
      sendEmail: vi.fn(async () => {
        throw new FollowupEmailError("cloudflare_E_RECIPIENT_SUPPRESSED");
      }),
    });

    await processFollowupQueueBatch({ messages: [message] }, deps);

    expect(deps.logVisitorFollowupPermanentFailure).toHaveBeenCalledWith("lead-1", {
      code: "cloudflare_E_RECIPIENT_SUPPRESSED",
    });
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
  });
});
