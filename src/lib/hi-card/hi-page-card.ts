import type { CardContact, CardRecord } from "@/card-data/types";

/** Public /hi page card: owner inbox and phone are withheld until after exchange. */
export type HiPageCard = Omit<CardRecord, "email" | "contact"> & {
  contact: Omit<CardContact, "phone">;
};

export type HiOwnerContact = {
  email: string;
  phone: string;
};

/** Null when a restored session has no owner inbox or phone to show on the receipt. */
export function ownerContactFromSessionFields(
  ownerEmail: string,
  ownerPhone: string,
): HiOwnerContact | null {
  const email = ownerEmail.trim();
  const phone = ownerPhone.trim();
  if (!email && !phone) {
    return null;
  }
  return { email, phone };
}

export function toHiPageCard(card: CardRecord): HiPageCard {
  const { email: _ownerEmail, contact, ...rest } = card;
  const { phone: _phone, ...contactPublic } = contact;
  return {
    ...rest,
    contact: contactPublic,
  };
}

export function ownerFirstName(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) {
    return "there";
  }
  return trimmed.split(/\s+/)[0] ?? trimmed;
}
