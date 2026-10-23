// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { cardRowToRecord } from "@/card-data/card-persist";
import { tryResolveHiCard } from "@/lib/hi-card/resolve-card-route";
import { HiPageClient } from "@/components/hi/HiPageClient";
import { serializePublicHiCard } from "@/lib/hi-card/public-card-payload";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { render, screen } from "@testing-library/react";

const { resolveCardForRequest } = vi.hoisted(() => ({
  resolveCardForRequest: vi.fn(),
}));

vi.mock("@/card-data/server", () => ({
  resolveCardForRequest,
}));

function parseJson<T>(_label: string, raw: string): T {
  return JSON.parse(raw) as T;
}

function legacyDidiRow(variant: string) {
  return {
    id: "didi-id",
    slug: "didi",
    variant,
    display_name: "Didi Shoukralla",
    account_id: "legacy-account",
    status: "live",
    owner_email: "didi@didi.build",
    photo_key: "didi",
    links_json: JSON.stringify({
      bookingUrl: "",
      items: [
        { type: "website", label: "didi.build", url: "https://didi.build" },
        {
          type: "linkedin",
          label: "LinkedIn",
          url: "https://www.linkedin.com/in/diadem-shoukralla/",
        },
      ],
      fallbackUrl: "https://didi.build/book",
    }),
    page_copy_json: JSON.stringify({
      pageTitle: "Didi Shoukralla · We Met",
      emailFromName: "Didi Shoukralla",
      headshotAlt: "Didi Shoukralla",
      name: "Didi Shoukralla",
      role: "Software Engineer and Technical Advisor",
      aboutTitle: "About me",
      about: ["I'm a software engineer in Toronto."],
      servicesTitle: "What I do",
      services: [{ label: "System audit", description: "Written summary." }],
      fallbackLabel: "or book a time directly",
    }),
    contact_json: JSON.stringify({
      name: {
        full: "Didi Shoukralla",
        family: "Shoukralla",
        given: "Didi",
        nickname: "Didi",
      },
      org: "Didi Build",
      title: "Software Engineer and Technical Advisor",
      email: "didi@didi.build",
      phone: "+1-416-555-0100",
      vcardNote: "Met via We Met",
      urls: [{ url: "https://didi.build", type: "Portfolio" }],
    }),
    copy_json: JSON.stringify({
      thanksMessage: "Thanks, {firstName}. Talk soon.",
      exchangeAriaLabel: "Exchange contacts",
      footerNavLabel: "Elsewhere",
      exchangeSheet: {
        exchangeTitle: "Let's stay in touch",
        detailsTitle: "Nice to meet you, {firstName} 👋",
        detailsIntro: "Add a few details.",
        nameLabel: "Full name",
        emailLabel: "Email",
        phoneLabel: "Phone",
        phoneOptional: "(optional)",
        countryCodeAriaLabel: "Country code",
        submitExchange: "Exchange contact",
        submitDetails: "Save details",
        consent: "",
        closeLabel: "Close",
        exchangeFormAriaLabel: "Exchange",
        detailsFormAriaLabel: "Details",
        notePlaceholder: "Note",
        jobTitleLabel: "Job title",
        companyLabel: "Company",
        noteLabel: "Note",
        pendingExchange: "Sending…",
        pendingDetails: "Saving…",
        detailsSaved: "Saved",
        networkErrorMessage: "Network error",
        exchangeNotSavedPrefix: "Prefix",
        exchangeNotSavedEmail: "help@didi.build",
        exchangeNotSavedSuffix: "Suffix",
        errors: {
          nameRequired: "Name",
          emailRequired: "Email",
          emailInvalid: "Invalid",
        },
      },
    }),
    updated_at: "2026-10-15T00:00:00.000Z",
  };
}

function stubMatchMedia() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })),
  );
}

describe("hi card route resolver (integration)", () => {
  beforeEach(() => {
    resolveCardForRequest.mockReset();
    stubMatchMedia();
  });

  it.each(["mono", "green", "purple"] as const)(
    "resolves cards regardless of stored variant %s",
    async (storedVariant) => {
      const record = cardRowToRecord(legacyDidiRow(storedVariant), parseJson);
      resolveCardForRequest.mockResolvedValue(record);

      const card = await tryResolveHiCard("didi");
      expect(card).not.toBeNull();
      expect(card?.slug).toBe("didi");
      expect(card?.variant).toBe("mono");
      expect(card?.alternate?.url).toBe("https://didi.build/book");
      expect(card?.links?.website).toBe("https://didi.build");
    },
  );

  it("renders legacy non-prod didi row shape (green variant, items + fallbackUrl)", () => {
    const record = cardRowToRecord(legacyDidiRow("green"), parseJson);
    render(
      <ThemeProvider>
        <HiPageClient
          card={serializePublicHiCard(record)}
          photoUrl={null}
          plan="free"
        />
      </ThemeProvider>,
    );
    expect(screen.getByText(/I'm Didi/)).toBeTruthy();
    expect(screen.getByText("About me")).toBeTruthy();
    expect(screen.getByRole("link", { name: /or book a time directly/i })).toBeTruthy();
    expect(
      screen.getAllByRole("link", { name: /Get your own card/i }).length,
    ).toBeGreaterThan(0);
  });
});
