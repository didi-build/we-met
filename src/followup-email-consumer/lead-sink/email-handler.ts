import {
  buildOwnerLeadAppendEmail,
  buildOwnerLeadRecordEmail,
} from "@/email/format-owner-lead-email";
import { resolveFromDisplayName } from "@/email/from-display-name";
import { FollowupEmailError } from "@/email/followup-email-error";
import { parseEmailSinkConfig } from "@/email/parse-email-sink-config";
import {
  resolveOutboundFromEmail,
  type OutboundFromSecrets,
} from "@/email/resolve-outbound-from";
import { resolveSinkEmailRecipient } from "@/email/recipient";
import { sanitizeEmailHeaderValue } from "@/email/mime-headers";
import type { EmailSendResult, OutboundEmail } from "@/email/types";
import type { VisitorEmailMode } from "@/app-settings/defaults";
import type {
  LeadSinkHandler,
  LeadSinkHandlerContext,
  ParsedLeadSinkAppendMessage,
  ParsedLeadSinkRecordMessage,
} from "@/followup-email-consumer/lead-sink/types";

export type EmailLeadSinkHandlerDeps = {
  weMetEnv: string;
  testMailTo?: string;
  outboundFrom: OutboundFromSecrets;
  fromDisplayName?: string;
  sendEmail: (message: OutboundEmail) => Promise<EmailSendResult>;
  logMalformedLeadSink(leadId: string): void;
  /** Per-delivery mode from {@link LeadSinkHandlerContext} (DIDI-745 template selection). */
  visitorEmailModeFromContext?: (ctx: LeadSinkHandlerContext) => VisitorEmailMode;
};

function cloudflareExternalRef(messageId: string | null): string {
  return JSON.stringify({
    provider: "cloudflare",
    messageId,
  });
}

export function createEmailLeadSinkHandler(
  deps: EmailLeadSinkHandlerDeps,
): LeadSinkHandler {
  return {
    appendRequiresRecord: false,

    async deliverRecord(message: ParsedLeadSinkRecordMessage, _ctx) {
      const sinkConfig = parseEmailSinkConfig(message.sinkConfig);
      if (!sinkConfig) {
        deps.logMalformedLeadSink(message.lead.leadId);
        throw new FollowupEmailError("malformed_sink_email_config");
      }

      const ownerFrom = resolveOutboundFromEmail(deps.outboundFrom);
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

      const fromDisplayName = resolveFromDisplayName(deps.fromDisplayName);
      const outbound: OutboundEmail = {
        from: ownerFrom,
        fromDisplayName,
        to: recipient.to,
        replyTo: sanitizeEmailHeaderValue(message.lead.email),
        subject: content.subject,
        textPlain: content.textPlain,
        textHtml: content.textHtml,
      };

      const sendResult = await deps.sendEmail(outbound);

      return {
        externalRef: cloudflareExternalRef(sendResult.messageId),
      };
    },

    async deliverAppend(message: ParsedLeadSinkAppendMessage, ctx) {
      const sinkConfig = parseEmailSinkConfig(message.sinkConfig);
      if (!sinkConfig) {
        deps.logMalformedLeadSink(message.lead.leadId);
        throw new FollowupEmailError("malformed_sink_email_config");
      }

      const ownerFrom = resolveOutboundFromEmail(deps.outboundFrom);
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
        phone: message.details.phone,
        jobTitle: message.details.jobTitle,
        company: message.details.company,
        note: message.details.note,
        nonProdSinkDestinationLabel: nonProdLabel,
      });

      const fromDisplayName = resolveFromDisplayName(deps.fromDisplayName);
      const outbound: OutboundEmail = {
        from: ownerFrom,
        fromDisplayName,
        to: recipient.to,
        replyTo: sanitizeEmailHeaderValue(message.lead.email),
        subject: content.subject,
        textPlain: content.textPlain,
        textHtml: content.textHtml,
      };

      if (ctx.recordRef !== null) {
        const recordMessageId =
          typeof ctx.recordRef.messageId === "string" ? ctx.recordRef.messageId : null;
        if (recordMessageId) {
          outbound.inReplyTo = recordMessageId;
          outbound.references = recordMessageId;
        }
      }

      const sendResult = await deps.sendEmail(outbound);

      return {
        externalRef: cloudflareExternalRef(sendResult.messageId),
      };
    },
  };
}
