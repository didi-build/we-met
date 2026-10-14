import { describe, expect, it } from "vitest";
import { buildRawEmailMessage } from "@/email/mime-message";
import type { OutboundEmail } from "@/email/types";

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

function decodeRawEmailMessage(raw: string): string {
  return base64UrlDecodeToString(raw);
}

function headerLines(mime: string): string[] {
  const headerEnd = mime.indexOf("\r\n\r\n");
  const block = headerEnd >= 0 ? mime.slice(0, headerEnd) : mime;
  return block.split("\r\n");
}

function headerValue(mime: string, name: string): string | undefined {
  const prefix = `${name}: `;
  const line = headerLines(mime).find((l) => l.startsWith(prefix));
  return line?.slice(prefix.length);
}

function decodeRfc2047Utf8Base64Header(value: string | undefined): string {
  if (!value) {
    return "";
  }
  const match = value.match(/^=\?UTF-8\?B\?([^?]+)\?=$/);
  if (!match) {
    return value;
  }
  return atob(match[1]);
}

function extractBase64Part(mime: string, contentTypePrefix: string): string {
  const pattern = new RegExp(
    `Content-Type: ${contentTypePrefix.replace("/", "\\/")}[^\\r]*\\r\\nContent-Transfer-Encoding: base64\\r\\n\\r\\n([A-Za-z0-9+/=\\r\\n]+)`,
  );
  const match = mime.match(pattern);
  if (!match) {
    return "";
  }
  const b64 = match[1].replace(/\r\n/g, "");
  return atob(b64);
}

describe("buildRawEmailMessage (unit)", () => {
  const baseEmail: OutboundEmail = {
    from: "sender@example.com",
    fromDisplayName: "Demo Owner",
    to: "test-inbox@example.com",
    replyTo: "owner@example.com",
    subject: "[we-met test → visitor@example.com] Hello Alex",
    textPlain: "Test delivery (visitor typed): visitor@example.com\n\nBody",
    textHtml: "<p>Test delivery (visitor typed): visitor@example.com</p>",
    attachments: [
      {
        filename: "Demo-User.vcf",
        mimeType: "text/vcard",
        body: "BEGIN:VCARD\nEND:VCARD\n",
      },
    ],
  };

  it("decodes To as a single redirect address in non-prod-shaped mail", () => {
    const raw = buildRawEmailMessage(baseEmail);
    const mime = decodeRawEmailMessage(raw);
    const to = headerValue(mime, "To");
    expect(to).toBe("test-inbox@example.com");
    expect(extractBase64Part(mime, "text/plain")).toContain("visitor@example.com");
    expect(decodeRfc2047Utf8Base64Header(headerValue(mime, "Subject"))).toContain(
      "visitor@example.com",
    );
    expect(headerLines(mime).filter((l) => l.startsWith("To:"))).toHaveLength(1);
  });

  it("sets Reply-To to sanitized owner email", () => {
    const raw = buildRawEmailMessage({
      ...baseEmail,
      replyTo: "owner\r\nBcc: evil@example.com",
    });
    const mime = decodeRawEmailMessage(raw);
    expect(headerValue(mime, "Reply-To")).toBe("owner Bcc: evil@example.com");
    expect(mime).not.toMatch(/^Bcc:/m);
  });

  it("includes vCard attachment with expected type and filename", () => {
    const raw = buildRawEmailMessage(baseEmail);
    const mime = decodeRawEmailMessage(raw);
    expect(mime).toContain(
      'Content-Type: text/vcard; charset=utf-8; name="Demo-User.vcf"',
    );
    expect(mime).toContain('Content-Disposition: attachment; filename="Demo-User.vcf"');
    const vcardB64 = btoa("BEGIN:VCARD\nEND:VCARD\n");
    expect(mime).toContain(vcardB64.slice(0, 16));
  });

  it("does not allow header injection via subject, display name, or filename", () => {
    const raw = buildRawEmailMessage({
      ...baseEmail,
      fromDisplayName: 'Evil"\r\nBcc: attacker@evil.com',
      subject: "Hi\r\nBcc: attacker@evil.com",
      attachments: [
        {
          filename: 'file"\r\nBcc: attacker@evil.com.vcf',
          mimeType: "text/vcard",
          body: "BEGIN:VCARD\nEND:VCARD\n",
        },
      ],
    });
    const mime = decodeRawEmailMessage(raw);
    const bccHeaders = headerLines(mime).filter((l) =>
      l.toLowerCase().startsWith("bcc:"),
    );
    expect(bccHeaders).toHaveLength(0);
    expect(headerLines(mime).filter((l) => l.startsWith("To:"))).toHaveLength(1);
  });
});
