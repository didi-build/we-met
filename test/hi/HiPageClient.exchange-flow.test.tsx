// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { forwardRef, useImperativeHandle } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { postHiDetails, postHiExchange } from "@/components/hi/hi-exchange-api";
import { exampleCardInput, exampleCardRecord } from "../helpers/example-card";

const sheetCopy = exampleCardInput().copy.exchangeSheet;

vi.mock("@/components/hi/hi-exchange-api", () => ({
  postHiExchange: vi.fn(),
  postHiDetails: vi.fn(),
  HI_EXCHANGE_REQUEST_TIMEOUT_MS: 15_000,
}));

const turnstileMock = {
  execute: vi.fn(),
  reset: vi.fn(),
  onSuccess: null as ((token: string) => void) | null,
};

vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: forwardRef(function MockTurnstile(
    props: { onSuccess: (token: string) => void },
    ref,
  ) {
    turnstileMock.onSuccess = props.onSuccess;
    useImperativeHandle(ref, () => ({
      execute: () => {
        turnstileMock.execute();
        props.onSuccess("turnstile-token");
      },
      reset: turnstileMock.reset,
    }));
    return null;
  }),
}));

import { HiPageClient } from "@/components/hi/HiPageClient";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { createDetailsToken } from "@/exchange/token";
import { toHiPageCard } from "@/lib/hi-card/hi-page-card";
import {
  exchangeCompletedStorageKey,
  exchangeSessionStorageKey,
} from "@/lib/hi-card/exchange-session-storage";
import { expectNoVisitorReceiptContactRow } from "./receipt-contact-test-helpers";

vi.mock("@/components/hi/hi-sheet-motion", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/components/hi/hi-sheet-motion")>();
  return {
    ...mod,
    prefersReducedMotion: () => true,
    runSheetCloseAnimation: ({ onComplete }: { onComplete: () => void }) => {
      onComplete();
      return () => {};
    },
  };
});

function injectGeneratedPaletteCss() {
  if (document.getElementById("test-palette-tokens")) {
    return;
  }
  const dir = join(process.cwd(), "src/theme/tokens");
  const style = document.createElement("style");
  style.id = "test-palette-tokens";
  style.textContent = ["mono.light.css", "mono.dark.css"]
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
  document.head.appendChild(style);
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

beforeAll(() => {
  injectGeneratedPaletteCss();
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
});

beforeEach(() => {
  stubMatchMedia();
  document.documentElement.setAttribute("data-theme", "light");
  document.documentElement.setAttribute("data-palette", "mono");
  vi.mocked(postHiExchange).mockReset();
  vi.mocked(postHiDetails).mockReset();
  turnstileMock.execute.mockReset();
  turnstileMock.onSuccess = null;
});

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  cleanup();
});

describe("HiPageClient exchange flow (component)", () => {
  it("writes session and completed flags after exchange without putting the token in localStorage", async () => {
    const record = exampleCardRecord({
      email: "owner-secret@example.com",
      contact: { ...exampleCardRecord().contact, phone: "+1 555 0100" },
    });
    const pageCard = toHiPageCard(record);
    const leadToken = "exchange-lead-token";

    vi.mocked(postHiExchange).mockResolvedValue({
      ok: true,
      token: leadToken,
      owner: { email: "owner-secret@example.com", phone: "+1 555 0100" },
    });

    render(
      <ThemeProvider>
        <HiPageClient card={pageCard} photoUrl={null} />
      </ThemeProvider>,
    );

    expect(screen.queryByText("owner-secret@example.com")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Exchange contact/i }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(
      dialog.querySelector('input[autocomplete="name"]') as HTMLInputElement,
      { target: { value: "Sam Visitor" } },
    );
    fireEvent.change(
      dialog.querySelector('input[autocomplete="email"]') as HTMLInputElement,
      { target: { value: "sam@example.com" } },
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: sheetCopy.submitExchange }),
    );

    await waitFor(() => {
      expect(postHiExchange).toHaveBeenCalled();
      expect(screen.getByText(/Sent to/)).toBeTruthy();
      expect(screen.getByRole("link", { name: /^Email$/i }).getAttribute("href")).toBe(
        "mailto:owner-secret@example.com",
      );
    });

    const sessionKey = exchangeSessionStorageKey(record.slug);
    const sessionRaw = window.sessionStorage.getItem(sessionKey);
    expect(sessionRaw).toBeTruthy();
    const session = JSON.parse(sessionRaw!) as {
      firstName: string;
      visitorEmail: string;
      leadToken: string;
    };
    expect(session).toEqual({
      firstName: "Sam",
      visitorEmail: "sam@example.com",
      leadToken,
      ownerEmail: "owner-secret@example.com",
      ownerPhone: "+1 555 0100",
    });
    expect(window.localStorage.getItem(exchangeCompletedStorageKey(record.slug))).toBe(
      "1",
    );

    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      const value = key ? window.localStorage.getItem(key) : "";
      expect(value).not.toContain(leadToken);
      expect(value).not.toContain("owner-secret@example.com");
      expect(value).not.toContain("+1 555 0100");
    }
    expect(window.location.href).not.toContain(leadToken);
    expect(window.location.href).not.toContain("owner-secret@example.com");
  });

  it("stores empty owner contact in session only and hides the email/call row after exchange", async () => {
    const record = exampleCardRecord({ slug: "empty-owner-exchange" });
    const pageCard = toHiPageCard(record);
    const leadToken = "empty-owner-lead-token";

    vi.mocked(postHiExchange).mockResolvedValue({
      ok: true,
      token: leadToken,
      owner: { email: "", phone: "" },
    });

    render(
      <ThemeProvider>
        <HiPageClient card={pageCard} photoUrl={null} />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Exchange contact/i }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(
      dialog.querySelector('input[autocomplete="name"]') as HTMLInputElement,
      { target: { value: "Sam Visitor" } },
    );
    fireEvent.change(
      dialog.querySelector('input[autocomplete="email"]') as HTMLInputElement,
      { target: { value: "sam@example.com" } },
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: sheetCopy.submitExchange }),
    );

    await waitFor(() => {
      expect(postHiExchange).toHaveBeenCalled();
      expect(screen.getByText(/Sent to/)).toBeTruthy();
      expectNoVisitorReceiptContactRow();
    });

    const sessionKey = exchangeSessionStorageKey(record.slug);
    const sessionRaw = window.sessionStorage.getItem(sessionKey);
    expect(sessionRaw).toBeTruthy();
    expect(JSON.parse(sessionRaw!)).toEqual({
      firstName: "Sam",
      visitorEmail: "sam@example.com",
      leadToken,
      ownerEmail: "",
      ownerPhone: "",
    });
    expect(window.localStorage.getItem(exchangeCompletedStorageKey(record.slug))).toBe(
      "1",
    );

    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      const value = key ? window.localStorage.getItem(key) : "";
      expect(value).not.toContain(leadToken);
      expect(value).not.toContain("ownerEmail");
      expect(value).not.toContain("ownerPhone");
    }
    expect(window.location.href).not.toContain(leadToken);
  });

  it("shows after-details receipt copy after the details step succeeds", async () => {
    const slug = "after-details-flow";
    const leadToken = createDetailsToken(
      "test-secret",
      {
        leadId: "lead-1",
        cardId: "test-id",
        cardSlug: slug,
        visitorEmail: "sam@example.com",
        visitorName: "Sam",
      },
      Math.floor(Date.now() / 1000),
    );
    window.sessionStorage.setItem(
      exchangeSessionStorageKey(slug),
      JSON.stringify({
        firstName: "Sam",
        visitorEmail: "sam@example.com",
        leadToken,
        ownerEmail: "owner@example.com",
        ownerPhone: "",
      }),
    );
    window.localStorage.setItem(exchangeCompletedStorageKey(slug), "1");
    vi.mocked(postHiDetails).mockResolvedValue({ ok: true });

    const pageCard = toHiPageCard(exampleCardRecord({ slug }));
    render(
      <ThemeProvider>
        <HiPageClient card={pageCard} photoUrl={null} />
      </ThemeProvider>,
    );

    expect(screen.getByText(/Sent to/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Tell .* more/i }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: sheetCopy.submitDetails }),
    );

    await waitFor(() => {
      expect(postHiDetails).toHaveBeenCalledWith({ token: leadToken });
      expect(screen.getByText("With your note")).toBeTruthy();
      expect(screen.getByText(/Your details were added. Thanks, Sam\./)).toBeTruthy();
    });
  });

  it("clears an expired session and shows reload fallback", () => {
    const slug = "expired-session";
    const now = Math.floor(Date.now() / 1000) - 3 * 60 * 60;
    const leadToken = createDetailsToken(
      "test-secret",
      {
        leadId: "lead-1",
        cardId: "test-id",
        cardSlug: slug,
        visitorEmail: "sam@example.com",
        visitorName: "Sam",
      },
      now,
    );
    window.sessionStorage.setItem(
      exchangeSessionStorageKey(slug),
      JSON.stringify({
        firstName: "Sam",
        visitorEmail: "sam@example.com",
        leadToken,
        ownerEmail: "",
        ownerPhone: "",
      }),
    );
    window.localStorage.setItem(exchangeCompletedStorageKey(slug), "1");

    render(
      <ThemeProvider>
        <HiPageClient
          card={toHiPageCard(exampleCardRecord({ slug }))}
          photoUrl={null}
        />
      </ThemeProvider>,
    );

    expect(window.sessionStorage.getItem(exchangeSessionStorageKey(slug))).toBeNull();
    expect(screen.getByRole("button", { name: /Contact sent/i })).toBeTruthy();
    expect(screen.queryByText(/Save .* contact/i)).toBeNull();
  });
});
