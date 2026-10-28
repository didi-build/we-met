import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryExchangeOwnerEmailStore } from "@/exchange-owner-email/memory-store";
import * as exchangeOwnerEmailD1 from "@/exchange-owner-email/d1-repository";

function seededExchangeOwnerEmailStore(): MemoryExchangeOwnerEmailStore {
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
import type { CardEmailSnapshot } from "@/exchange/types";
import followupEmailConsumer from "../../workers/we-met-followup-email-consumer/index";
import type { FollowupConsumerEnv } from "@/followup-email-consumer/process-batch";
import * as leadDeliveryLedger from "@/followup-email-consumer/lead-delivery-ledger";
import type { D1Database } from "@cloudflare/workers-types";
import type { CloudflareOutboundMessage } from "@/email/cloudflare-sender";
import { MemoryConsumerLeadDeliveryLedger } from "./memory-consumer-ledger";

function createNoopConsumerD1(
  appSettings: Record<string, string> = {
    lead_email_enabled: "1",
    visitor_email_mode: "direct",
    daily_cap_global: "150",
    daily_cap_per_card: "50",
  },
): D1Database {
  const stmt = {
    bind: (...keys: string[]) => ({
      run: async () => ({ meta: { changes: 0 } }),
      first: async () => null,
      all: async () => ({
        results: keys
          .filter((key) => key in appSettings)
          .map((key) => ({ key, value: appSettings[key] })),
      }),
    }),
  };
  return {
    prepare: () => stmt,
  } as unknown as D1Database;
}

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

describe("follow-up email consumer worker queue (integration)", () => {
  beforeEach(() => {
    vi.spyOn(
      exchangeOwnerEmailD1,
      "createExchangeOwnerEmailStoreFromD1",
    ).mockImplementation(() => seededExchangeOwnerEmailStore());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("acks and sends mail through queue handler with Cloudflare EMAIL binding", async () => {
    let capturedPayload: CloudflareOutboundMessage | undefined;
    const emailSend = vi.fn(async (message: CloudflareOutboundMessage) => {
      capturedPayload = message;
      return { messageId: "<msg@mail.we-met.link>" };
    });

    const ack = vi.fn();
    const retry = vi.fn();
    const bucket = {
      get: vi.fn(async () => ({
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([0xff, 0xd8, 0xff]));
            controller.close();
          },
        }),
        httpMetadata: { contentType: "image/jpeg" },
      })),
    };

    const env: FollowupConsumerEnv = {
      WE_MET_ENV: "preview",
      WE_MET_BASE_URL: "https://we-met.link",
      WE_MET_EMAIL_FROM_CLOUDFLARE: "hello@mail.we-met.link",
      WE_MET_FROM_DISPLAY_NAME: "Diadem at We Met",
      WE_MET_TEST_MAIL_TO: "test-inbox@example.com",
      WE_MET_ASSETS: bucket as never,
      WE_MET_DB: createNoopConsumerD1(),
      EMAIL: { send: emailSend },
    };

    await followupEmailConsumer.queue(
      {
        messages: [
          {
            id: "m1",
            attempts: 1,
            body: {
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
            },
            ack,
            retry,
          },
        ],
      },
      env,
    );

    expect(ack).toHaveBeenCalledOnce();
    expect(retry).not.toHaveBeenCalled();
    expect(emailSend).toHaveBeenCalledOnce();
    expect(capturedPayload?.to).toBe("test-inbox@example.com");
    expect(capturedPayload?.from.email).toBe("hello@mail.we-met.link");
    expect(capturedPayload?.replyTo).toBe("owner@example.com");
    expect(capturedPayload?.text).toContain("visitor@example.com");
    const attachment = capturedPayload?.attachments?.[0];
    expect(attachment?.filename).toBe("Demo-User.vcf");
    const vcardBody = attachment ? atob(attachment.content.replace(/\s/g, "")) : "";
    expect(vcardBody).toContain("BEGIN:VCARD");
    expect(vcardBody).toContain("PHOTO;ENCODING=b;TYPE=JPEG:");
  });

  it("retries with cloudflare_binding_missing when EMAIL binding is unset", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const ack = vi.fn();
    const retry = vi.fn();

    const env: FollowupConsumerEnv = {
      WE_MET_ENV: "preview",
      WE_MET_BASE_URL: "https://we-met.link",
      WE_MET_EMAIL_FROM_CLOUDFLARE: "hello@mail.we-met.link",
      WE_MET_FROM_DISPLAY_NAME: "Diadem at We Met",
      WE_MET_TEST_MAIL_TO: "test-inbox@example.com",
      WE_MET_ASSETS: { get: vi.fn() } as never,
      WE_MET_DB: createNoopConsumerD1(),
    };

    await followupEmailConsumer.queue(
      {
        messages: [
          {
            id: "m1",
            attempts: 1,
            body: {
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
            },
            ack,
            retry,
          },
        ],
      },
      env,
    );

    expect(ack).not.toHaveBeenCalled();
    expect(retry).toHaveBeenCalledOnce();
    const failureLog = errorSpy.mock.calls.find(
      (call) => call[0] === "visitor_followup_attempt_failure",
    );
    expect(failureLog?.[1]).toMatchObject({
      leadId: "lead-1",
      errorCode: "cloudflare_binding_missing",
      willRetry: true,
    });
    errorSpy.mockRestore();
  });

  it.each([
    {
      label: "email_provider row is missing",
      includeEmailProvider: false,
      emailProvider: "",
    },
    { label: 'email_provider is ""', includeEmailProvider: true, emailProvider: "" },
    {
      label: "email_provider is smtp",
      includeEmailProvider: true,
      emailProvider: "smtp",
    },
    {
      label: "email_provider is gmail",
      includeEmailProvider: true,
      emailProvider: "gmail",
    },
  ])(
    "sends via Cloudflare EMAIL binding when $label",
    async ({ includeEmailProvider, emailProvider }) => {
      const emailSend = vi.fn(async () => ({ messageId: "<msg@mail.we-met.link>" }));
      const ack = vi.fn();
      const retry = vi.fn();

      const appSettings: Record<string, string> = {
        lead_email_enabled: "1",
        visitor_email_mode: "direct",
        daily_cap_global: "150",
        daily_cap_per_card: "50",
      };
      if (includeEmailProvider) {
        appSettings.email_provider = emailProvider;
      }

      const env: FollowupConsumerEnv = {
        WE_MET_ENV: "preview",
        WE_MET_BASE_URL: "https://we-met.link",
        WE_MET_EMAIL_FROM_CLOUDFLARE: "hello@mail.we-met.link",
        WE_MET_FROM_DISPLAY_NAME: "Diadem at We Met",
        WE_MET_TEST_MAIL_TO: "test-inbox@example.com",
        WE_MET_ASSETS: { get: vi.fn() } as never,
        WE_MET_DB: createNoopConsumerD1(appSettings),
        EMAIL: { send: emailSend },
      };

      await followupEmailConsumer.queue(
        {
          messages: [
            {
              id: "m1",
              attempts: 1,
              body: {
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
              },
              ack,
              retry,
            },
          ],
        },
        env,
      );

      expect(emailSend).toHaveBeenCalledOnce();
      expect(ack).toHaveBeenCalledOnce();
      expect(retry).not.toHaveBeenCalled();
    },
  );

  it("redirects owner email sink mail to the test inbox when WE_MET_ENV is missing (integration)", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "record");
    vi.spyOn(leadDeliveryLedger, "createConsumerLeadDeliveryLedger").mockReturnValue(
      ledger,
    );

    let capturedPayload: CloudflareOutboundMessage | undefined;
    const emailSend = vi.fn(async (message: CloudflareOutboundMessage) => {
      capturedPayload = message;
      return { messageId: "<msg@mail.we-met.link>" };
    });
    const ack = vi.fn();
    const retry = vi.fn();

    const env = {
      WE_MET_BASE_URL: "https://we-met.link",
      WE_MET_EMAIL_FROM_CLOUDFLARE: "hello@mail.we-met.link",
      WE_MET_FROM_DISPLAY_NAME: "Diadem at We Met",
      WE_MET_TEST_MAIL_TO: "test-inbox@example.com",
      WE_MET_ASSETS: { get: vi.fn() } as never,
      WE_MET_DB: createNoopConsumerD1(),
      EMAIL: { send: emailSend },
    } as unknown as FollowupConsumerEnv;

    await followupEmailConsumer.queue(
      {
        messages: [
          {
            id: "m1",
            attempts: 1,
            body: {
              type: "lead_sink_record",
              sinkId: "sink-1",
              sinkKind: "email",
              sinkConfig: { to: "owner@example.com" },
              lead: {
                leadId: "lead-1",
                submittedAt: "2026-10-12T00:00:00.000Z",
                environment: "preview",
                isTestLead: true,
                name: "Alex Visitor",
                email: "visitor@example.com",
                phone: null,
              },
              cardId: "card-1",
              cardSlug: "demo",
              sourceUrl: "https://we-met.link/hi/demo",
            },
            ack,
            retry,
          },
        ],
      },
      env,
    );

    expect(ack).toHaveBeenCalledOnce();
    expect(retry).not.toHaveBeenCalled();
    expect(emailSend).toHaveBeenCalledOnce();
    expect(capturedPayload?.to).toBe("test-inbox@example.com");
    expect(capturedPayload?.subject).toContain("[we-met test → owner@example.com]");
  });
});
