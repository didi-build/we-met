import {
  buildOwnerLeadAppendEmail,
  buildOwnerLeadAppendMessageId,
  buildOwnerLeadRecordEmail,
  buildOwnerLeadRecordMessageId,
} from "@/email/format-owner-lead-email";
import { resolveFromDisplayName } from "@/email/from-display-name";
import { FollowupEmailError } from "@/email/followup-email-error";
import { resolveOwnerFromEmail } from "@/email/owner-from";
import { parseEmailSinkConfig } from "@/email/parse-email-sink-config";
import { resolveSinkEmailRecipient } from "@/email/recipient";
import { sanitizeEmailHeaderValue } from "@/email/mime-headers";
import type { EmailSender } from "@/email/types";
import type {
  LeadSinkHandler,
  ParsedLeadSinkAppendMessage,
  ParsedLeadSinkRecordMessage,
} from "@/followup-email-consumer/lead-sink/types";

export type EmailLeadSinkHandlerDeps = {
  weMetEnv: string;
  testMailTo?: string;
  ownerFromEmail?: string;
  fromDisplayName?: string;
  emailSender: EmailSender;
  logMalformedLeadSink(leadId: string): void;
};

function emailExternalRef(
  gmailMessageId: string | null,
  gmailThreadId: string | null,
): string {
  return JSON.stringify({
    gmailMessageId,
    gmailThreadId,
  });
}

export function createEmailLeadSinkHandler(
  deps: EmailLeadSinkHandlerDeps,
): LeadSinkHandler {
  return {
    appendRequiresRecord: false,

    async deliverRecord(message: ParsedLeadSinkRecordMessage) {
      const sinkConfig = parseEmailSinkConfig(message.sinkConfig);
      if (!sinkConfig) {
        deps.logMalformedLeadSink(message.lead.leadId);
        throw new FollowupEmailError("malformed_sink_email_config");
      }

      const ownerFrom = resolveOwnerFromEmail(deps.ownerFromEmail);
      const recipient = resolveSinkEmailRecipient({
        weMetEnv: deps.weMetEnv,
        sinkDestinationEmail: sinkConfig.to,
        testMailTo: deps.testMailTo,
      });
      const nonProdLabel =
        recipient.mode === "nonprod" ? recipient.sinkDestinationForContent : undefined;

      const content = buildOwnerLeadRecordEmail({
        name: message.lead.name,
        email: message.lead.email,
        phone: message.lead.phone,
        sourceUrl: message.sourceUrl,
        receivedAtIso: message.lead.submittedAt,
        nonProdSinkDestinationLabel: nonProdLabel,
      });

      const messageId = buildOwnerLeadRecordMessageId(
        message.lead.leadId,
        message.sinkId,
        ownerFrom,
      );

      const fromDisplayName = resolveFromDisplayName(deps.fromDisplayName);
      const sendResult = await deps.emailSender.send({
        from: ownerFrom,
        fromDisplayName,
        to: recipient.to,
        replyTo: sanitizeEmailHeaderValue(message.lead.email),
        subject: content.subject,
        textPlain: content.textPlain,
        textHtml: content.textHtml,
        messageId,
      });

      return {
        externalRef: emailExternalRef(sendResult.messageId, sendResult.threadId),
      };
    },

    async deliverAppend(message: ParsedLeadSinkAppendMessage, ctx) {
      const sinkConfig = parseEmailSinkConfig(message.sinkConfig);
      if (!sinkConfig) {
        deps.logMalformedLeadSink(message.lead.leadId);
        throw new FollowupEmailError("malformed_sink_email_config");
      }

      const ownerFrom = resolveOwnerFromEmail(deps.ownerFromEmail);
      const recipient = resolveSinkEmailRecipient({
        weMetEnv: deps.weMetEnv,
        sinkDestinationEmail: sinkConfig.to,
        testMailTo: deps.testMailTo,
      });
      const nonProdLabel =
        recipient.mode === "nonprod" ? recipient.sinkDestinationForContent : undefined;

      const content = buildOwnerLeadAppendEmail({
        name: message.lead.name,
        email: message.lead.email,
        jobTitle: message.details.jobTitle,
        company: message.details.company,
        note: message.details.note,
        nonProdSinkDestinationLabel: nonProdLabel,
      });

      const recordMessageId =
        ctx.recordRef !== null
          ? buildOwnerLeadRecordMessageId(
              message.lead.leadId,
              message.sinkId,
              ownerFrom,
            )
          : undefined;
      const threadId =
        ctx.recordRef !== null && typeof ctx.recordRef.gmailThreadId === "string"
          ? ctx.recordRef.gmailThreadId
          : undefined;

      const appendMessageId = buildOwnerLeadAppendMessageId(
        message.lead.leadId,
        message.sinkId,
        ownerFrom,
      );

      const fromDisplayName = resolveFromDisplayName(deps.fromDisplayName);
      const sendResult = await deps.emailSender.send({
        from: ownerFrom,
        fromDisplayName,
        to: recipient.to,
        replyTo: sanitizeEmailHeaderValue(message.lead.email),
        subject: content.subject,
        textPlain: content.textPlain,
        textHtml: content.textHtml,
        messageId: appendMessageId,
        ...(recordMessageId
          ? { inReplyTo: recordMessageId, references: recordMessageId }
          : {}),
        ...(threadId ? { threadId } : {}),
      });

      return {
        externalRef: emailExternalRef(sendResult.messageId, sendResult.threadId),
      };
    },
  };
}
