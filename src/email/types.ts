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
};

export type EmailSender = {
  send(message: OutboundEmail): Promise<void>;
};
