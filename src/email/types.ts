export type EmailAttachment = {
  filename: string;
  mimeType: string;
  body: string;
};

export type OutboundEmail = {
  from: string;
  fromDisplayName?: string;
  to: string;
  replyTo?: string;
  subject: string;
  textPlain: string;
  textHtml: string;
  attachments?: EmailAttachment[];
  /** Gmail API thread id (optional). */
  threadId?: string;
  /** RFC 5322 Message-ID header value (optional). */
  messageId?: string;
  inReplyTo?: string;
  references?: string;
};

export type EmailSendResult = {
  messageId: string | null;
  threadId: string | null;
};

export type EmailSender = {
  send(message: OutboundEmail): Promise<EmailSendResult>;
};
