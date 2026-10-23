import {
  buildOwnerLeadAppendEmail,
  buildOwnerLeadAppendMessageId,
  buildOwnerLeadRecordEmail,
  buildOwnerLeadRecordMessageId,
} from "@/email/format-owner-lead-email";
import { resolveFromDisplayName } from "@/email/from-display-name";
import type { EmailProvider } from "@/email/email-provider";
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
  sendEmail: (
    provider: EmailProvider,
    message: OutboundEmail,
  ) => Promise<EmailSendResult>;
  logMalformedLeadSink(leadId: string): void;
  /** Per-delivery mode from {@link LeadSinkHandlerContext} (DIDI-745 template selection). */
  visitorEmailModeFromContext?: (ctx: LeadSinkHandlerContext) => VisitorEmailMode;
};

function gmailExternalRef(
  gmailMessageId: string | null,
  gmailThreadId: string | null,
): string {
  return JSON.stringify({
    gmailMessageId,
    gmailThreadId,
  });
}

function cloudflareExternalRef(messageId: string | null): string {
  return JSON.stringify({
    provider: "cloudflare",
    messageId,
  });
}

function externalRefForProvider(
  provider: EmailProvider,
  sendResult: EmailSendResult,
): string {
  if (provider === "cloudflare") {
    return cloudflareExternalRef(sendResult.messageId);
  }
  return gmailExternalRef(sendResult.messageId, sendResult.threadId);
}

export function createEmailLeadSinkHandler(
  deps: EmailLeadSinkHandlerDeps,
): LeadSinkHandler {
  const visitorEmailModeFromContext =
    deps.visitorEmailModeFromContext ?? ((ctx) => ctx.visitorEmailMode);

  return {
    appendRequiresRecord: false,

    async deliverRecord(message: ParsedLeadSinkRecordMessage, ctx) {
      const visitorEmailMode = visitorEmailModeFromContext(ctx);
      void visitorEmailMode;
      const sinkConfig = parseEmailSinkConfig(message.sinkConfig);
      if (!sinkConfig) {
        deps.logMalformedLeadSink(message.lead.leadId);
        throw new FollowupEmailError("malformed_sink_email_config");
      }

      const provider = ctx.emailProvider;
      const ownerFrom = resolveOutboundFromEmail(provider, deps.outboundFrom);
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

      if (provider === "gmail") {
        outbound.messageId = buildOwnerLeadRecordMessageId(
          message.lead.leadId,
          message.sinkId,
          ownerFrom,
        );
      }

      const sendResult = await deps.sendEmail(provider, outbound);

      return {
        externalRef: externalRefForProvider(provider, sendResult),
      };
    },

    async deliverAppend(message: ParsedLeadSinkAppendMessage, ctx) {
      const visitorEmailMode = visitorEmailModeFromContext(ctx);
      void visitorEmailMode;
      const sinkConfig = parseEmailSinkConfig(message.sinkConfig);
      if (!sinkConfig) {
        deps.logMalformedLeadSink(message.lead.leadId);
        throw new FollowupEmailError("malformed_sink_email_config");
      }

      const provider = ctx.emailProvider;
      const ownerFrom = resolveOutboundFromEmail(provider, deps.outboundFrom);
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

      if (provider === "gmail") {
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

        outbound.messageId = buildOwnerLeadAppendMessageId(
          message.lead.leadId,
          message.sinkId,
          ownerFrom,
        );
        if (recordMessageId) {
          outbound.inReplyTo = recordMessageId;
          outbound.references = recordMessageId;
        }
        if (threadId) {
          outbound.threadId = threadId;
        }
      } else if (ctx.recordRef !== null) {
        const recordMessageId =
          typeof ctx.recordRef.messageId === "string" ? ctx.recordRef.messageId : null;
        if (recordMessageId) {
          outbound.inReplyTo = recordMessageId;
          outbound.references = recordMessageId;
        }
      }

      const sendResult = await deps.sendEmail(provider, outbound);

      return {
        externalRef: externalRefForProvider(provider, sendResult),
      };
    },
  };
}
