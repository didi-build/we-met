const CONTACTS_SCOPE = "https://www.googleapis.com/auth/contacts";

export function contactsOAuthScope(): string {
  return CONTACTS_SCOPE;
}

export function parseCommaSeparatedList(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const value = part.trim().toLowerCase();
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
  }
  return out;
}

export function readContactSenderAddresses(env: CloudflareEnv): string[] {
  return parseCommaSeparatedList(env.WE_MET_CONTACT_SENDER_ADDRESSES);
}

export function readContactsSetupAllowlist(env: CloudflareEnv): string[] {
  return parseCommaSeparatedList(env.CONTACTS_SETUP_ALLOWLIST);
}

export function contactsSetupEnabledForAll(env: CloudflareEnv): boolean {
  const raw = env.CONTACTS_SETUP_ENABLED_FOR_ALL?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

export function isContactsSetupEligible(
  env: CloudflareEnv,
  ownerEmail: string,
): boolean {
  if (contactsSetupEnabledForAll(env)) {
    return true;
  }
  const allowlist = readContactsSetupAllowlist(env);
  if (allowlist.length === 0) {
    return false;
  }
  const email = ownerEmail.trim().toLowerCase();
  return allowlist.includes(email);
}

export function parseSavedContactSenderAddresses(
  json: string | null | undefined,
): string[] {
  if (!json?.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of parsed) {
      if (typeof item !== "string") {
        continue;
      }
      const value = item.trim().toLowerCase();
      if (!value || seen.has(value)) {
        continue;
      }
      seen.add(value);
      out.push(value);
    }
    return out;
  } catch {
    return [];
  }
}

export function serializeContactSenderAddresses(addresses: string[]): string {
  return JSON.stringify(addresses);
}
