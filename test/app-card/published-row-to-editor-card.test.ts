import { publishedRowToEditorCard } from "@/app-card/editor-persist";
import { describe, expect, it } from "vitest";

describe("publishedRowToEditorCard (unit)", () => {
  it("reads phone from contact_json.phone", () => {
    const card = publishedRowToEditorCard(
      {
        slug: "ada",
        photo_key: null,
        page_copy_json: JSON.stringify({
          name: "Ada Lovelace",
          role: "Mathematician",
        }),
        links_json: JSON.stringify({ bookingUrl: "" }),
        contact_json: JSON.stringify({
          phone: "+1 (555) 123-4567",
          name: { full: "Ada Lovelace" },
        }),
      },
      <T>(raw: string) => JSON.parse(raw) as T,
    );
    expect(card.phone).toBe("+1 (555) 123-4567");
  });
});
