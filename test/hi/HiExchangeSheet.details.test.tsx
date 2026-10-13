// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HiExchangeSheet } from "@/components/hi/HiExchangeSheet";
import { postHiDetails } from "@/components/hi/hi-exchange-api";
import { exampleCardInput } from "../helpers/example-card";

vi.mock("@/components/hi/hi-exchange-api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/components/hi/hi-exchange-api")>();
  return {
    ...mod,
    postHiExchange: vi.fn(),
    postHiDetails: vi.fn(),
  };
});

vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: () => null,
}));

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

const sheetCopy = exampleCardInput().copy.exchangeSheet;

function renderDetailsStep() {
  render(
    <HiExchangeSheet
      slug="demo"
      copy={sheetCopy}
      open
      initialStep="details"
      firstName="Ada"
      leadToken="lead-token"
      onClose={() => {}}
      onExchangeSuccess={() => {}}
    />,
  );
}

function submitDetails() {
  fireEvent.click(screen.getByRole("button", { name: sheetCopy.submitDetails }));
}

function alertText(): string {
  return screen.getByRole("alert").textContent ?? "";
}

describe("HiExchangeSheet details submit", () => {
  beforeEach(() => {
    vi.mocked(postHiDetails).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows not-saved copy on a details server failure", async () => {
    vi.mocked(postHiDetails).mockResolvedValue({ ok: false, kind: "server" });

    renderDetailsStep();
    submitDetails();

    await waitFor(() => {
      expect(alertText()).toContain(sheetCopy.exchangeNotSavedPrefix.trim());
    });
    expect(alertText()).not.toContain("invalid_token");
    expect(alertText()).not.toContain("server_error");
    expect(alertText()).not.toContain("invalid_input");
  });

  it("shows the network message on a details network failure", async () => {
    vi.mocked(postHiDetails).mockResolvedValue({ ok: false, kind: "network" });

    renderDetailsStep();
    submitDetails();

    await waitFor(() => {
      expect(alertText()).toContain(sheetCopy.networkErrorMessage);
    });
  });

  it("shows saved copy on success", async () => {
    vi.mocked(postHiDetails).mockResolvedValue({ ok: true });

    renderDetailsStep();
    submitDetails();

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain(sheetCopy.detailsSaved);
    });
  });
});
