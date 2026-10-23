import type { CardContact, CardPageCopy } from "@/card-data/types";

export type VisitorLead = {
  leadId: string;
  submittedAt: string;
  environment: string;
  isTestLead: boolean;
  name: string;
  email: string;
  phone: string | null;
};

export type VisitorLeadDetails = {
  jobTitle: string | null;
  company: string | null;
  note: string | null;
};

/** Lead fields on append-details sink messages (no fabricated exchange metadata). */
export type LeadSinkAppendLead = {
  leadId: string;
  name: string;
  email: string;
};

export type CardEmailSnapshot = {
  slug: string;
  displayName: string;
  email: string;
  photoKey: string | null;
  contact: CardContact;
  pageCopy: Pick<CardPageCopy, "emailFromName">;
};

export type ExchangeSuccessResponse = {
  token: string;
  ownerEmail: string;
  ownerPhone?: string;
};

export type ExchangeErrorCode =
  | "invalid_input"
  | "turnstile_failed"
  | "rate_limited"
  | "card_not_found"
  | "server_error";

export type DetailsErrorCode = "invalid_input" | "invalid_token" | "server_error";
