import {
  isContactsSetupEligible,
  parseSavedContactSenderAddresses,
  readContactSenderAddresses,
} from "@/app-auth/contacts-setup-config";
import type { AccountRow } from "@/app-auth/accounts";
import type { ContactsSetupUi } from "@/app-api/types";

export function computeContactsSetupUi(
  env: CloudflareEnv,
  account: Pick<AccountRow, "email" | "contact_added_at" | "contact_sender_addresses">,
  suppressedThisSession: boolean,
): ContactsSetupUi {
  if (suppressedThisSession) {
    return { visible: false };
  }
  if (!isContactsSetupEligible(env, account.email)) {
    return { visible: false };
  }

  const configured = readContactSenderAddresses(env);
  if (configured.length === 0) {
    return { visible: false };
  }

  const saved = parseSavedContactSenderAddresses(account.contact_sender_addresses);
  if (!account.contact_added_at) {
    return { visible: true, variant: "default" };
  }

  const savedSet = new Set(saved);
  const missing = configured.filter((address) => !savedSet.has(address));
  if (missing.length === 0) {
    return { visible: false };
  }

  return {
    visible: true,
    variant: "reappear",
    newSenderAddress: missing[0],
  };
}
