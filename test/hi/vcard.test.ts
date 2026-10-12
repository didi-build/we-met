import { describe, expect, it } from "vitest";
import { exampleCardInput } from "../helpers/example-card";
import { buildVCard, escapeVCardValue, foldVCardLine } from "@/lib/hi/vcard";

describe("escapeVCardValue", () => {
  it("escapes vCard special characters", () => {
    expect(escapeVCardValue("a;b,c\\n")).toBe("a\\;b\\,c\\\\n");
  });
});

describe("buildVCard", () => {
  const contact = exampleCardInput().contact;

  it("uses CRLF line endings and required fields", () => {
    const vcard = buildVCard(contact);

    expect(vcard).toContain("\r\n");
    expect(vcard.startsWith("BEGIN:VCARD\r\n")).toBe(true);
    expect(vcard.endsWith("END:VCARD\r\n")).toBe(true);
    expect(vcard).toContain(`FN:${contact.name.full}`);
    expect(vcard).toContain(`EMAIL;TYPE=INTERNET,WORK:${contact.email}`);
    expect(vcard).toContain(`NOTE:${contact.vcardNote.replace(/;/g, "\\;")}`);
    expect(vcard).not.toContain("PHOTO;");
  });

  it("includes photo when provided", () => {
    const vcard = buildVCard(contact, {
      photo: { base64: "aGVsbG8=", mime: "image/jpeg" },
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
});
