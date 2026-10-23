import {
  parseSavedContactSenderAddresses,
  serializeContactSenderAddresses,
} from "@/app-auth/contacts-setup-config";
import { nowIso } from "@/app-auth/time";
import type { D1Database } from "@cloudflare/workers-types";

const PEOPLE_API = "https://people.googleapis.com/v1";
const CONTACT_DISPLAY_NAME = "We Met";
const READ_MASK = "names,emailAddresses,etag";

type PersonEmail = { value?: string; type?: string; formattedType?: string };
type Person = {
  resourceName?: string;
  etag?: string;
  names?: { displayName?: string }[];
  emailAddresses?: PersonEmail[];
};

export type SyncWeMetContactResult =
  { ok: true; addressesAdded: string[] } | { ok: false; reason: "people_api_failed" };

type SearchContactsResult =
  { ok: true; people: Person[] } | { ok: false; reason: "people_api_failed" };

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function personEmails(person: Person): Set<string> {
  const set = new Set<string>();
  for (const entry of person.emailAddresses ?? []) {
    if (entry.value?.trim()) {
      set.add(normalizeEmail(entry.value));
    }
  }
  return set;
}

function personMatchesSender(person: Person, senderAddresses: string[]): boolean {
  const emails = personEmails(person);
  return senderAddresses.some((address) => emails.has(normalizeEmail(address)));
}

async function peopleFetch(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${accessToken}`);
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return fetch(`${PEOPLE_API}${path}`, { ...init, headers });
}

async function warmUpSearchContacts(accessToken: string): Promise<boolean> {
  const response = await peopleFetch(accessToken, "/people:searchContacts", {
    method: "POST",
    body: JSON.stringify({ query: "", readMask: READ_MASK, pageSize: 1 }),
  });
  return response.ok;
}

async function searchContactsByQuery(
  accessToken: string,
  query: string,
): Promise<SearchContactsResult> {
  const response = await peopleFetch(accessToken, "/people:searchContacts", {
    method: "POST",
    body: JSON.stringify({ query, readMask: READ_MASK, pageSize: 30 }),
  });
  if (!response.ok) {
    return { ok: false, reason: "people_api_failed" };
  }
  try {
    const json = (await response.json()) as { results?: { person?: Person }[] };
    const people: Person[] = [];
    for (const result of json.results ?? []) {
      if (result.person?.resourceName) {
        people.push(result.person);
      }
    }
    return { ok: true, people };
  } catch {
    return { ok: false, reason: "people_api_failed" };
  }
}

async function findMatchingContact(
  accessToken: string,
  senderAddresses: string[],
): Promise<
  { ok: true; person: Person | null } | { ok: false; reason: "people_api_failed" }
> {
  const seen = new Set<string>();
  for (const address of senderAddresses) {
    const hits = await searchContactsByQuery(accessToken, address);
    if (!hits.ok) {
      return { ok: false, reason: "people_api_failed" };
    }
    for (const person of hits.people) {
      const key = person.resourceName ?? "";
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      if (personMatchesSender(person, senderAddresses)) {
        return { ok: true, person };
      }
    }
  }
  return { ok: true, person: null };
}

async function createWeMetContact(
  accessToken: string,
  senderAddresses: string[],
): Promise<Person | null> {
  const response = await peopleFetch(accessToken, "/people:createContact", {
    method: "POST",
    body: JSON.stringify({
      names: [{ givenName: CONTACT_DISPLAY_NAME }],
      emailAddresses: senderAddresses.map((value) => ({ value })),
    }),
  });
  if (!response.ok) {
    return null;
  }
  try {
    return (await response.json()) as Person;
  } catch {
    return null;
  }
}

async function updateWeMetContactEmails(
  accessToken: string,
  person: Person,
  emailAddresses: PersonEmail[],
): Promise<boolean> {
  if (!person.resourceName || !person.etag) {
    return false;
  }
  const response = await peopleFetch(
    accessToken,
    `/${person.resourceName}:updateContact?updatePersonFields=emailAddresses`,
    {
      method: "PATCH",
      headers: { "if-match": person.etag },
      body: JSON.stringify({
        etag: person.etag,
        emailAddresses,
      }),
    },
  );
  return response.ok;
}

function missingSenderAddresses(person: Person, senderAddresses: string[]): string[] {
  const have = personEmails(person);
  return senderAddresses.filter((address) => !have.has(normalizeEmail(address)));
}

export async function syncWeMetGoogleContact(
  accessToken: string,
  senderAddresses: string[],
): Promise<SyncWeMetContactResult> {
  if (!senderAddresses.length) {
    return { ok: false, reason: "people_api_failed" };
  }

  const warmed = await warmUpSearchContacts(accessToken);
  if (!warmed) {
    return { ok: false, reason: "people_api_failed" };
  }

  const match = await findMatchingContact(accessToken, senderAddresses);
  if (!match.ok) {
    return { ok: false, reason: "people_api_failed" };
  }

  const normalizedSenders = senderAddresses.map(normalizeEmail);

  if (!match.person) {
    const created = await createWeMetContact(accessToken, senderAddresses);
    if (!created) {
      return { ok: false, reason: "people_api_failed" };
    }
    return { ok: true, addressesAdded: normalizedSenders };
  }

  const existing = match.person;
  const missing = missingSenderAddresses(existing, senderAddresses);
  if (missing.length === 0) {
    return { ok: true, addressesAdded: [] };
  }

  const emailAddresses: PersonEmail[] = [
    ...(existing.emailAddresses ?? []),
    ...missing.map((value) => ({ value })),
  ];
  const updated = await updateWeMetContactEmails(accessToken, existing, emailAddresses);
  if (!updated) {
    return { ok: false, reason: "people_api_failed" };
  }
  return { ok: true, addressesAdded: missing.map(normalizeEmail) };
}

export async function saveContactsSetupCompletion(
  db: D1Database,
  accountId: string,
  configuredSenderAddresses: string[],
  previousJson: string | null | undefined,
): Promise<void> {
  const previous = parseSavedContactSenderAddresses(previousJson);
  const merged = new Set(previous.map(normalizeEmail));
  for (const address of configuredSenderAddresses) {
    merged.add(normalizeEmail(address));
  }
  const now = nowIso();
  await db
    .prepare(
      `UPDATE accounts
       SET contact_added_at = ?, contact_sender_addresses = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(now, serializeContactSenderAddresses([...merged]), now, accountId)
    .run();
}
