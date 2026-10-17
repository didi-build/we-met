import type { CardContact } from "@/card-data/types";

const CRLF = "\r\n";
const VCARD_LINE_MAX = 75;

/** Reject values that would inject extra vCard lines or other control characters. */
export function containsVCardControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 32 || code === 127) {
      return true;
    }
  }
  return false;
}

/** Escape text values per vCard 3.0 (RFC 2426). */
export function escapeVCardValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n/g, "\\n")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\n");
}

/** Fold a single vCard content line per RFC 2426 (75 octets, continuation with CRLF + space). */
export function foldVCardLine(line: string): string {
  if (line.length <= VCARD_LINE_MAX) {
    return line;
  }
  const chunks: string[] = [line.slice(0, VCARD_LINE_MAX)];
  let index = VCARD_LINE_MAX;
  while (index < line.length) {
    chunks.push(` ${line.slice(index, index + VCARD_LINE_MAX - 1)}`);
    index += VCARD_LINE_MAX - 1;
  }
  return chunks.join(CRLF);
}

function joinVCardLines(lines: string[]): string {
  return lines.map(foldVCardLine).join(CRLF) + CRLF;
}

export type VCardPhoto = {
  base64: string;
};

export function buildVCard(
  contact: CardContact,
  options: { ownerEmail: string; photo?: VCardPhoto | null },
): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${escapeVCardValue(contact.name.family)};${escapeVCardValue(contact.name.given)};;;`,
    `FN:${escapeVCardValue(contact.name.full)}`,
  ];

  const nickname = contact.name.nickname.trim();
  if (nickname) {
    lines.push(`NICKNAME:${escapeVCardValue(nickname)}`);
  }

  lines.push(
    `ORG:${escapeVCardValue(contact.org)}`,
    `TITLE:${escapeVCardValue(contact.title)}`,
    `EMAIL;TYPE=INTERNET,WORK:${escapeVCardValue(options.ownerEmail)}`,
  );

  const phone = contact.phone.trim();
  if (phone && !containsVCardControlChars(phone)) {
    lines.push(`TEL;TYPE=CELL:${escapeVCardValue(phone)}`);
  }

  if (options.photo?.base64) {
    lines.push(`PHOTO;ENCODING=b;TYPE=JPEG:${options.photo.base64}`);
  }

  for (const entry of contact.urls) {
    const url = entry.url.trim();
    if (!url || containsVCardControlChars(url)) {
      continue;
    }
    const typeSuffix = entry.type ? `;TYPE=${escapeVCardValue(entry.type)}` : "";
    lines.push(`URL${typeSuffix}:${url}`);
  }

  lines.push(`NOTE:${escapeVCardValue(contact.vcardNote)}`, "END:VCARD");

  return joinVCardLines(lines);
}

export async function readAssetAsBase64(asset: {
  body: ReadableStream<Uint8Array>;
}): Promise<string> {
  const reader = asset.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      chunks.push(value);
      total += value.length;
    }
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  let binary = "";
  for (const byte of merged) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
