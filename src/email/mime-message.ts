import type { EmailAttachment, OutboundEmail } from "@/email/types";
import {
  encodeEmailSubject,
  formatEmailFromHeader,
  sanitizeEmailHeaderValue,
} from "@/email/mime-headers";

function base64UrlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64EncodeMimeBody(value: string): string {
  const base64 = btoa(
    Array.from(new TextEncoder().encode(value), (byte) =>
      String.fromCharCode(byte),
    ).join(""),
  );
  const lines: string[] = [];
  for (let i = 0; i < base64.length; i += 76) {
    lines.push(base64.slice(i, i + 76));
  }
  return lines.join("\r\n");
}

function createMimeBoundary(): string {
  return `----=_Part_${crypto.randomUUID().replace(/-/g, "")}`;
}

function escapeMimeQuotedParameter(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildMultipartAlternative(
  boundary: string,
  textPlain: string,
  textHtml: string,
): string {
  return [
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64EncodeMimeBody(textPlain),
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64EncodeMimeBody(textHtml),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

function buildAttachmentPart(
  mixedBoundary: string,
  attachment: EmailAttachment,
): string {
  const filename = escapeMimeQuotedParameter(
    sanitizeEmailHeaderValue(attachment.filename),
  );
  const mimeType = sanitizeEmailHeaderValue(attachment.mimeType);
  return [
    `--${mixedBoundary}`,
    `Content-Type: ${mimeType}; charset=utf-8; name="${filename}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${filename}"`,
    "",
    base64EncodeMimeBody(attachment.body),
    "",
  ].join("\r\n");
}

/** Build a Gmail API `raw` message (base64url) with optional attachments. */
export function buildRawEmailMessage(email: OutboundEmail): string {
  const from = formatEmailFromHeader(email.from, email.fromDisplayName);
  const to = sanitizeEmailHeaderValue(email.to);
  const subject = encodeEmailSubject(email.subject);
  const attachments = email.attachments ?? [];

  if (attachments.length === 0) {
    const boundary = createMimeBoundary();
    const mimeBody = buildMultipartAlternative(
      boundary,
      email.textPlain,
      email.textHtml,
    );
    const lines = [
      `From: ${from}`,
      `To: ${to}`,
      ...(email.replyTo
        ? [`Reply-To: ${sanitizeEmailHeaderValue(email.replyTo)}`]
        : []),
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      mimeBody,
    ];
    return base64UrlEncode(lines.join("\r\n"));
  }

  const mixedBoundary = createMimeBoundary();
  const altBoundary = createMimeBoundary();
  const alternativePart = buildMultipartAlternative(
    altBoundary,
    email.textPlain,
    email.textHtml,
  );

  const parts = [
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    alternativePart,
    ...attachments.map((attachment) => buildAttachmentPart(mixedBoundary, attachment)),
    `--${mixedBoundary}--`,
    "",
  ];

  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    ...(email.replyTo ? [`Reply-To: ${sanitizeEmailHeaderValue(email.replyTo)}`] : []),
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    "",
    parts.join("\r\n"),
  ];
  return base64UrlEncode(lines.join("\r\n"));
}
