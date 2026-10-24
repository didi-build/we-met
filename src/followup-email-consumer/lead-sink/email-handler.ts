import { buildOwnerDirectExchangeEmail } from "@/email/format-owner-lead-email";
import { buildOwnerRelayEmail } from "@/email/format-owner-relay-email";
import { resolveFromDisplayName } from "@/email/from-display-name";
import { FollowupEmailError } from "@/email/followup-email-error";
import { parseEmailSinkConfig } from "@/email/parse-email-sink-config";
import {
  resolveOutboundFromEmail,
  type OutboundFromSecrets,
} from "@/email/resolve-outbound-from";
import { resolveOwnerSinkReplyTo, resolveSinkEmailRecipient } from "@/email/recipient";
import { sanitizeEmailHeaderValue } from "@/email/mime-headers";
import type { EmailSendResult, OutboundEmail } from "@/email/types";
import type { VisitorEmailMode } from "@/app-settings/defaults";
import type { VisitorLeadDetails } from "@/exchange/types";
import type {
  LeadSinkHandler,
  LeadSinkHandlerContext,
  LeadSinkDeliveryResult,
  ParsedLeadSinkAppendMessage,
  ParsedLeadSinkOwnerEmailMessage,
  ParsedLeadSinkRecordMessage,
} from "@/followup-email-consumer/lead-sink/types";

export type EmailLeadSinkHandlerDeps = {
  weMetEnv: string;
  testMailTo?: string;
  outboundFrom: OutboundFromSecrets;
  fromDisplayName?: string;
  sendEmail: (message: OutboundEmail) => Promise<EmailSendResult>;
  logMalformedLeadSink(leadId: string): void;
};

function cloudflareExternalRef(messageId: string | null): string {
  return JSON.stringify({
    provider: "cloudflare",
    messageId,
  });
}

function buildOwnerEmailContent(
  visitorEmailMode: VisitorEmailMode,
  lead: { name: string; email: string; submittedAt?: string },
  details: VisitorLeadDetails,
  sourceUrl: string,
  nonProdLabel: string | undefined,
): { subject: string; textPlain: string; textHtml: string } {
  if (visitorEmailMode === "owner_relay") {
    return buildOwnerRelayEmail({
      name: lead.name,
      email: lead.email,
      phone: details.phone,
      jobTitle: details.jobTitle,
      company: details.company,
      note: details.note,
      sourceUrl,
      nonProdSinkDestinationLabel: nonProdLabel,
    });
  }

  return buildOwnerDirectExchangeEmail({
    name: lead.name,
    email: lead.email,
    phone: details.phone,
    jobTitle: details.jobTitle,
    company: details.company,
    note: details.note,
    sourceUrl,
    receivedAtIso: lead.submittedAt ?? new Date().toISOString(),
    nonProdSinkDestinationLabel: nonProdLabel,
  });
}

async function deliverOwnerEmailMessage(
  deps: EmailLeadSinkHandlerDeps,
  message: {
    sinkConfig: unknown;
    lead: { leadId: string; name: string; email: string; submittedAt?: string };
    details: VisitorLeadDetails;
    sourceUrl: string;
  },
  ctx: LeadSinkHandlerContext,
): Promise<LeadSinkDeliveryResult> {
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

  const content = buildOwnerEmailContent(
    ctx.visitorEmailMode,
    message.lead,
    message.details,
    message.sourceUrl,
    nonProdLabel,
  );

  const fromDisplayName = resolveFromDisplayName(deps.fromDisplayName);
  const replyTo = sanitizeEmailHeaderValue(
    resolveOwnerSinkReplyTo({
      weMetEnv: deps.weMetEnv,
      visitorEmail: message.lead.email,
      testMailTo: deps.testMailTo,
    }),
  );

  const outbound: OutboundEmail = {
    from: ownerFrom,
    fromDisplayName,
    to: recipient.to,
    replyTo,
    subject: content.subject,
    textPlain: content.textPlain,
    textHtml: content.textHtml,
  };

  const sendResult = await deps.sendEmail(outbound);

  return {
    externalRef: cloudflareExternalRef(sendResult.messageId),
  };
}

export function createEmailLeadSinkHandler(
  deps: EmailLeadSinkHandlerDeps,
): LeadSinkHandler {
  return {
    appendRequiresRecord: false,

    async deliverRecord(message: ParsedLeadSinkRecordMessage, ctx) {
      const emptyDetails: VisitorLeadDetails = {
        phone: message.lead.phone,
        jobTitle: null,
        company: null,
        note: null,
      };
      return deliverOwnerEmailMessage(deps, { ...message, details: emptyDetails }, ctx);
    },

    async deliverAppend(message: ParsedLeadSinkAppendMessage, ctx) {
      return deliverOwnerEmailMessage(deps, message, ctx);
    },

    async deliverOwnerEmail(message: ParsedLeadSinkOwnerEmailMessage, ctx) {
      return deliverOwnerEmailMessage(deps, message, ctx);
    },
  };
}
