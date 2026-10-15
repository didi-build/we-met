import {
  buildOwnerLeadAppendEmail,
  buildOwnerLeadAppendMessageId,
  buildOwnerLeadRecordEmail,
  buildOwnerLeadRecordMessageId,
  WE_MET_OWNER_EMAIL_DISPLAY_NAME,
} from "@/email/format-owner-lead-email";
import { resolveOwnerFromEmail } from "@/email/owner-from";
import { resolveSinkEmailRecipient } from "@/email/recipient";
import { sanitizeEmailHeaderValue } from "@/email/mime-headers";
import type { EmailSender } from "@/email/types";
import type { ConsumerLeadDeliveryLedger } from "@/followup-email-consumer/lead-delivery-ledger";
import type {
  LeadSinkHandler,
  ParsedLeadSinkAppendMessage,
  ParsedLeadSinkRecordMessage,
} from "@/followup-email-consumer/lead-sink/types";

export type EmailLeadSinkHandlerDeps = {
  weMetEnv: string;
  testMailTo?: string;
  ownerFromEmail?: string;
  emailSender: EmailSender;
  ledger: ConsumerLeadDeliveryLedger;
  logLedgerRowMissing(leadId: string, sinkId: string): void;
  logLedgerUpdateFailed(leadId: string, sinkId: string, errorCode: string): void;
  now: () => Date;
};

export function createEmailLeadSinkHandler(
  deps: EmailLeadSinkHandlerDeps,
): LeadSinkHandler {
  async function ensureQueuedRow(
    leadId: string,
    sinkId: string,
    phase: "record" | "append",
  ): Promise<"proceed" | "skip" | "missing"> {
    const row = await deps.ledger.findRow(leadId, sinkId, phase);
    if (!row) {
      deps.logLedgerRowMissing(leadId, sinkId);
      return "missing";
    }
    if (row.status === "sent" || row.status === "failed") {
      return "skip";
    }
    return "proceed";
  }

  async function afterSendMarkSent(
    leadId: string,
    sinkId: string,
    phase: "record" | "append",
    gmailMessageId: string | null,
    gmailThreadId: string | null,
  ): Promise<void> {
    const sentAt = deps.now().toISOString();
    const updated = await deps.ledger.markSent({
      leadId,
      sinkId,
      phase,
      sentAt,
      gmailMessageId,
      gmailThreadId,
    });
    if (!updated) {
      deps.logLedgerUpdateFailed(leadId, sinkId, "ledger_update_failed");
    }
  }

  return {
    async handleRecord(message: ParsedLeadSinkRecordMessage) {
      const gate = await ensureQueuedRow(message.lead.leadId, message.sinkId, "record");
      if (gate !== "proceed") {
        return;
      }

      const ownerFrom = resolveOwnerFromEmail(deps.ownerFromEmail);
      const recipient = resolveSinkEmailRecipient({
        weMetEnv: deps.weMetEnv,
        sinkDestinationEmail: message.sinkConfig.to,
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

      const sendResult = await deps.emailSender.send({
        from: ownerFrom,
        fromDisplayName: WE_MET_OWNER_EMAIL_DISPLAY_NAME,
        to: recipient.to,
        replyTo: sanitizeEmailHeaderValue(message.lead.email),
        subject: content.subject,
        textPlain: content.textPlain,
        textHtml: content.textHtml,
        messageId,
      });

      await afterSendMarkSent(
        message.lead.leadId,
        message.sinkId,
        "record",
        sendResult.messageId,
        sendResult.threadId,
      );
    },

    async handleAppend(message: ParsedLeadSinkAppendMessage) {
      const gate = await ensureQueuedRow(message.lead.leadId, message.sinkId, "append");
      if (gate !== "proceed") {
        return;
      }

      const ownerFrom = resolveOwnerFromEmail(deps.ownerFromEmail);
      const recipient = resolveSinkEmailRecipient({
        weMetEnv: deps.weMetEnv,
        sinkDestinationEmail: message.sinkConfig.to,
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
        sourceUrl: message.sourceUrl,
        detailsSubmittedAtIso: message.detailsSubmittedAt,
        nonProdSinkDestinationLabel: nonProdLabel,
      });

      const recordRow = await deps.ledger.findRow(
        message.lead.leadId,
        message.sinkId,
        "record",
      );
      const recordMessageId =
        recordRow?.status === "sent"
          ? buildOwnerLeadRecordMessageId(
              message.lead.leadId,
              message.sinkId,
              ownerFrom,
            )
          : undefined;
      const threadId =
        recordRow?.status === "sent"
          ? (recordRow.gmailThreadId ?? undefined)
          : undefined;

      const appendMessageId = buildOwnerLeadAppendMessageId(
        message.lead.leadId,
        message.sinkId,
        ownerFrom,
      );

      const sendResult = await deps.emailSender.send({
        from: ownerFrom,
        fromDisplayName: WE_MET_OWNER_EMAIL_DISPLAY_NAME,
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

      await afterSendMarkSent(
        message.lead.leadId,
        message.sinkId,
        "append",
        sendResult.messageId,
        sendResult.threadId,
      );
    },
  };
}
