import { describe, expect, it } from "vitest";
import { lookupCard } from "@/card-data/lookup";
import { MemoryCardRepository } from "@/card-data/memory-repository";
import type { CardLoadInput } from "@/card-data/types";

const hostConfig = {
  baseUrl: "https://we-met.link",
  previewHostSuffix: "-we-met.preview.workers.dev",
};

const sampleCard: CardLoadInput = {
  slug: "didi",
  variant: "green",
  displayName: "Didi",
  email: "hello@example.com",
  photoKey: null,
  footerLink: { label: "Site", url: "https://example.com" },
  pageCopy: {
    pageTitle: "Hi",
    emailFromName: "Didi",
    headshotAlt: "Didi",
    greetingName: "Didi",
    exchangeButton: "Exchange",
    bookLink: "Book",
  },
  contact: {
    name: {
      full: "Didi",
      family: "X",
      given: "Didi",
      nickname: "Didi",
    },
    org: "Org",
    title: "Title",
    email: "hello@example.com",
    phone: "+1-555-0100",
    vcardNote: "Note",
  },
  exchangeCopy: {},
};

describe("lookup (unit)", () => {
  it("resolves by slug on the card host", async () => {
    const repo = new MemoryCardRepository();
    await repo.upsertCard(sampleCard);
    const card = await lookupCard(
      { hostname: "we-met.link", pathname: "/hi/didi" },
      repo,
      hostConfig,
    );
    expect(card?.slug).toBe("didi");
  });

  it("resolves by slug on preview hosts matching the suffix", async () => {
    const repo = new MemoryCardRepository();
    await repo.upsertCard(sampleCard);
    const card = await lookupCard(
      {
        hostname: "pr-1-we-met.preview.workers.dev",
        pathname: "/hi/didi",
      },
      repo,
      hostConfig,
    );
    expect(card?.slug).toBe("didi");
  });

  it("returns null for unknown slug", async () => {
    const repo = new MemoryCardRepository();
    const card = await lookupCard(
      { hostname: "we-met.link", pathname: "/hi/unknown" },
      repo,
      hostConfig,
    );
    expect(card).toBeNull();
  });

  it("returns null for invalid slug path", async () => {
    const repo = new MemoryCardRepository();
    const card = await lookupCard(
      { hostname: "we-met.link", pathname: "/hi/INVALID" },
      repo,
      hostConfig,
    );
    expect(card).toBeNull();
  });

  it("does not resolve reserved hostnames via hostname table", async () => {
    const repo = new MemoryCardRepository();
    await repo.upsertCard(sampleCard);
    await repo.upsertHostname({ hostname: "app.we-met.link", slug: "didi" });
    const card = await lookupCard(
      { hostname: "app.we-met.link", pathname: "/" },
      repo,
      hostConfig,
    );
    expect(card).toBeNull();
  });

  it("resolves custom hostname mappings", async () => {
    const repo = new MemoryCardRepository();
    await repo.upsertCard(sampleCard);
    await repo.upsertHostname({ hostname: "card.example.com", slug: "didi" });
    const card = await lookupCard(
      { hostname: "card.example.com", pathname: "/" },
      repo,
      hostConfig,
    );
    expect(card?.slug).toBe("didi");
  });
});
