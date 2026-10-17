import { describe, expect, it } from "vitest";
import { exampleCardInput } from "../helpers/example-card";
import type { CardContact } from "@/card-data/types";
import {
  buildVCard,
  containsVCardControlChars,
  escapeVCardValue,
  foldVCardLine,
} from "@/lib/hi/vcard";

describe("escapeVCardValue", () => {
  it("escapes vCard special characters", () => {
    expect(escapeVCardValue("a;b,c\\n")).toBe("a\\;b\\,c\\\\n");
  });
});

describe("buildVCard", () => {
  const contact = exampleCardInput().contact;
  const ownerEmail = exampleCardInput().email;

  it("uses CRLF line endings and required fields", () => {
    const vcard = buildVCard(contact, { ownerEmail });

    expect(vcard).toContain("\r\n");
    expect(vcard.startsWith("BEGIN:VCARD\r\n")).toBe(true);
    expect(vcard.endsWith("END:VCARD\r\n")).toBe(true);
    expect(vcard).toContain(`FN:${contact.name.full}`);
    expect(vcard).toContain(`EMAIL;TYPE=INTERNET,WORK:${ownerEmail}`);
    expect(vcard).toContain(`NOTE:${contact.vcardNote.replace(/;/g, "\\;")}`);
    expect(vcard).not.toContain("PHOTO;");
  });

  it("includes photo when provided", () => {
    const vcard = buildVCard(contact, {
      ownerEmail,
      photo: { base64: "aGVsbG8=" },
    });
    expect(vcard).toContain("PHOTO;ENCODING=b;TYPE=JPEG:aGVsbG8=");
  });

  it("folds long lines and keeps CRLF endings", () => {
    const longLine = "A".repeat(120);
    const folded = foldVCardLine(longLine);
    expect(
      folded
        .split("\r\n")
        .every((segment, index) => (index === 0 ? true : segment.startsWith(" "))),
    ).toBe(true);
  });

  it("omits TEL when phone is empty", () => {
    const noPhone = { ...contact, phone: "" };
    const vcard = buildVCard(noPhone, { ownerEmail });
    expect(vcard).not.toMatch(/^TEL;/m);
  });

  it("includes TEL when phone is set", () => {
    const withPhone = { ...contact, phone: "+1-416-555-0100" };
    const vcard = buildVCard(withPhone, { ownerEmail });
    expect(vcard).toContain("TEL;TYPE=CELL:+1-416-555-0100");
  });

  it("does not emit extra vCard lines from injected phone", () => {
    const injected = { ...contact, phone: "+1 555 0100\r\nX-INJECT:1" };
    const vcard = buildVCard(injected, { ownerEmail });
    expect(vcard).not.toMatch(/^TEL;/m);
    expect(vcard).not.toContain("X-INJECT");
  });

  it("omits NICKNAME when nickname is empty", () => {
    const noNick: CardContact = {
      ...contact,
      name: { ...contact.name, nickname: "" },
    };
    const vcard = buildVCard(noNick, { ownerEmail });
    expect(vcard).not.toMatch(/^NICKNAME:/m);
  });

  it("skips URL lines that contain control characters", () => {
    const badUrl: CardContact = {
      ...contact,
      urls: [{ url: "https://evil.test\r\nX:1", type: "Website" }],
    };
    const vcard = buildVCard(badUrl, { ownerEmail });
    expect(vcard).not.toMatch(/^URL/m);
    expect(vcard).not.toContain("X:1");
  });
});

describe("containsVCardControlChars", () => {
  it("detects line breaks", () => {
    expect(containsVCardControlChars("ok")).toBe(false);
    expect(containsVCardControlChars("a\nb")).toBe(true);
    expect(containsVCardControlChars("a\rb")).toBe(true);
  });
});
