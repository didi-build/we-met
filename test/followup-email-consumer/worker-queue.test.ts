import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CardEmailSnapshot } from "@/exchange/types";
import { resetGmailTokenCacheForTests } from "@/email/gmail-sender";
import { generateTestServiceAccount } from "../helpers/gmail-test-service-account";
import followupEmailConsumer from "../../workers/we-met-followup-email-consumer/index";
import type { FollowupConsumerEnv } from "@/followup-email-consumer/process-batch";
import type { D1Database } from "@cloudflare/workers-types";

function createNoopConsumerD1(): D1Database {
  const stmt = {
    bind: () => ({
      run: async () => ({ meta: { changes: 0 } }),
      first: async () => null,
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

function base64UrlDecodeToString(raw: string): string {
  let b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) {
    b64 += "=";
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function headerValue(mime: string, name: string): string | undefined {
  const headerEnd = mime.indexOf("\r\n\r\n");
  const block = headerEnd >= 0 ? mime.slice(0, headerEnd) : mime;
  const prefix = `${name}: `;
  const line = block.split("\r\n").find((l) => l.startsWith(prefix));
  return line?.slice(prefix.length);
}

function extractPlainTextFromMime(mime: string): string {
  const match = mime.match(
    /Content-Type: text\/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=\r\n]+)/,
  );
  if (!match) {
    return "";
  }
  return atob(match[1].replace(/\r\n/g, ""));
}

function decodeAllMimeBase64Bodies(mime: string): string[] {
  const bodies: string[] = [];
  const re =
    /Content-Transfer-Encoding: base64\r\n(?:Content-Disposition:[^\r]*\r\n)?\r\n([A-Za-z0-9+/=\r\n]+)/g;
  for (const match of mime.matchAll(re)) {
    const normalized = match[1].replace(/\r\n/g, "").replace(/[^A-Za-z0-9+/=]/g, "");
    try {
      bodies.push(atob(normalized));
    } catch {
      // skip non-base64 chunks
    }
  }
  return bodies;
}

describe("follow-up email consumer worker queue (integration)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    resetGmailTokenCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = originalFetch;
  });

  it("acks and sends mail through queue handler with stubbed Gmail and R2", async () => {
    const { json } = await generateTestServiceAccount();
    let capturedRaw = "";
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("oauth2.googleapis.com")) {
        return new Response(
          JSON.stringify({ access_token: "token-1", expires_in: 3600 }),
          { status: 200 },
        );
      }
      const body = JSON.parse(init?.body as string) as { raw?: string };
      capturedRaw = body.raw ?? "";
      return new Response(JSON.stringify({ id: "msg-id" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchFn);

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
      GMAIL_SENDER: "sender@example.com",
      GMAIL_SERVICE_ACCOUNT_JSON: json,
      WE_MET_OWNER_FROM_EMAIL: "hello@we-met.link",
      WE_MET_FROM_DISPLAY_NAME: "Diadem at We Met",
      WE_MET_TEST_MAIL_TO: "test-inbox@example.com",
      WE_MET_ASSETS: bucket as never,
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

    expect(ack).toHaveBeenCalledOnce();
    expect(retry).not.toHaveBeenCalled();
    expect(fetchFn).toHaveBeenCalledTimes(2);

    const mime = base64UrlDecodeToString(capturedRaw);
    expect(headerValue(mime, "To")).toBe("test-inbox@example.com");
    expect(headerValue(mime, "From")).toContain("hello@we-met.link");
    expect(headerValue(mime, "Reply-To")).toBe("owner@example.com");
    expect(extractPlainTextFromMime(mime)).toContain("visitor@example.com");
    const vcardBody = decodeAllMimeBase64Bodies(mime).find((part) =>
      part.includes("BEGIN:VCARD"),
    );
    expect(vcardBody).toContain("PHOTO;ENCODING=b;TYPE=JPEG:");
  });

  it("retries with gmail_secret_missing when GMAIL_SENDER is unset", async () => {
    const { json } = await generateTestServiceAccount();
    const fetchFn = vi.fn();
    vi.stubGlobal("fetch", fetchFn);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const ack = vi.fn();
    const retry = vi.fn();

    const env: FollowupConsumerEnv = {
      WE_MET_ENV: "preview",
      GMAIL_SENDER: "",
      GMAIL_SERVICE_ACCOUNT_JSON: json,
      WE_MET_OWNER_FROM_EMAIL: "hello@we-met.link",
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
                leadId: "lead-2",
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

    expect(fetchFn).not.toHaveBeenCalled();
    expect(ack).not.toHaveBeenCalled();
    expect(retry).toHaveBeenCalledOnce();
    const failureLog = errorSpy.mock.calls.find(
      (call) => call[0] === "visitor_followup_attempt_failure",
    );
    expect(failureLog?.[1]).toMatchObject({
      leadId: "lead-2",
      errorCode: "gmail_secret_missing",
      secretName: "GMAIL_SENDER",
      willRetry: true,
    });
    errorSpy.mockRestore();
  });
});
