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
