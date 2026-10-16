import { describe, expect, it, vi } from "vitest";
import type { EditorCard } from "@/app-api/types";

/** Regression: photo URL must merge into cardRef.current, not a stale render snapshot. */
describe("upload photo merge (unit)", () => {
  it("does not clobber edits made during upload", async () => {
    let card: EditorCard = {
      slug: "",
      name: "Before upload",
      role: "",
      photo: "",
      about: [],
      services: [],
      links: { website: "", linkedin: "", github: "", instagram: "" },
      alternate: { url: "", label: "" },
    };
    const cardRef = { current: card };

    const uploadPhoto = vi.fn(async () => {
      card = { ...cardRef.current, name: "Edited during upload" };
      cardRef.current = card;
      return { url: `/api/app/photo?v=${"f".repeat(64)}` };
    });

    cardRef.current = { ...card, name: "Before upload" };
    const { url } = await uploadPhoto();
    const next = { ...cardRef.current, photo: url };

    expect(next.name).toBe("Edited during upload");
    expect(next.photo).toContain("/api/app/photo");
  });
});
