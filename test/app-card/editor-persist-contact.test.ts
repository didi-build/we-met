import { editorCardToLoadInput } from "@/app-card/editor-persist";
import type { EditorCard } from "@/app-api/types";
import { describe, expect, it } from "vitest";

function baseCard(overrides: Partial<EditorCard> = {}): EditorCard {
  return {
    slug: "slug",
    name: "Display",
    role: "Role",
    photo: "",
    about: [],
    services: [],
    links: {
      website: "https://example.com",
      linkedin: "https://linkedin.com/in/me",
      github: "https://github.com/me",
      instagram: "https://instagram.com/me",
    },
    alternate: { url: "", label: "" },
    ...overrides,
  };
}

const GOOGLE_NAME = "Ada Lovelace";

describe("editorCardToLoadInput contact and names", () => {
  it("orders social URLs after website and skips empty values", () => {
    const input = editorCardToLoadInput(
      baseCard({
        links: {
          website: "https://site.test",
          linkedin: "https://linkedin.com/in/x",
          github: "",
          instagram: "  ",
        },
      }),
      null,
      GOOGLE_NAME,
    );
    expect(input.contact.urls).toEqual([
      { url: "https://site.test", type: "Website" },
      { url: "https://linkedin.com/in/x", type: "LinkedIn" },
    ]);
  });

  it("includes all three socials in order when set", () => {
    const input = editorCardToLoadInput(baseCard(), null, GOOGLE_NAME);
    expect(input.contact.urls.map((u) => u.type)).toEqual([
      "Website",
      "LinkedIn",
      "GitHub",
      "Instagram",
    ]);
  });

  it("uses Google name for vCard structured name and display name for nickname when different", () => {
    const input = editorCardToLoadInput(baseCard({ name: "Ada" }), null, GOOGLE_NAME);
    expect(input.contact.name.full).toBe(GOOGLE_NAME);
    expect(input.contact.name.given).toBe("Ada");
    expect(input.contact.name.family).toBe("Lovelace");
    expect(input.contact.name.nickname).toBe("Ada");
    expect(input.displayName).toBe("Ada");
    expect(input.pageCopy.emailFromName).toBe("Ada");
  });

  it("omits nickname when display name matches Google name (case-insensitive)", () => {
    const input = editorCardToLoadInput(
      baseCard({ name: "ada lovelace" }),
      null,
      GOOGLE_NAME,
    );
    expect(input.contact.name.nickname).toBe("");
  });

  it("resolves empty display name to Google name everywhere", () => {
    const input = editorCardToLoadInput(baseCard({ name: "" }), null, GOOGLE_NAME);
    expect(input.displayName).toBe(GOOGLE_NAME);
    expect(input.name).toBe(GOOGLE_NAME);
    expect(input.pageCopy.pageTitle).toBe(`${GOOGLE_NAME} · We Met`);
    expect(input.contact.name.nickname).toBe("");
  });

  it("stores trimmed phone and drops unsafe values", () => {
    const input = editorCardToLoadInput(
      baseCard({ phone: " +1 555 0100 " }),
      null,
      GOOGLE_NAME,
    );
    expect(input.contact.phone).toBe("+1 555 0100");

    const unsafe = editorCardToLoadInput(
      baseCard({ phone: "+1 555 0100\r\nX-INJECT:1" }),
      null,
      GOOGLE_NAME,
    );
    expect(unsafe.contact.phone).toBe("");
  });
});
