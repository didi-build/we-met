// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { HiExchangeSheet } from "@/components/hi/HiExchangeSheet";
import { exampleCardInput } from "../helpers/example-card";

const sheetCopy = exampleCardInput().copy.exchangeSheet;

vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: () => null,
}));

vi.mock("@/components/hi/hi-exchange-api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/components/hi/hi-exchange-api")>();
  return {
    ...mod,
    postHiDetailsDismiss: vi.fn(async () => ({ ok: true as const })),
  };
});

vi.mock("@/components/hi/hi-sheet-motion", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/components/hi/hi-sheet-motion")>();
  return {
    ...mod,
    prefersReducedMotion: () => false,
    runSheetCloseAnimation: ({ onComplete }: { onComplete: () => void }) => {
      onComplete();
      return () => {};
    },
  };
});

function SheetHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" data-testid="open-sheet" onClick={() => setOpen(true)}>
        Open
      </button>
      <HiExchangeSheet
        slug="demo"
        copy={sheetCopy}
        open={open}
        initialStep="exchange"
        firstName="Alex"
        leadToken="test-token"
        onClose={() => setOpen(false)}
        onExchangeSuccess={() => {}}
      />
    </>
  );
}

function queryPanel(): HTMLElement | null {
  return document.querySelector('[role="dialog"]');
}

function queryScrim(): HTMLElement | null {
  return document.querySelector("[data-hi-scrim]");
}

describe("HiExchangeSheet reopen motion", () => {
  it("applies enter animation classes on the first render after a close", async () => {
    render(<SheetHarness />);

    fireEvent.click(screen.getByTestId("open-sheet"));
    expect(queryPanel()?.className).toContain("animate-hi-sheet-in");
    expect(queryScrim()?.className).toContain("animate-hi-scrim-in");

    fireEvent.click(queryScrim()!);
    await waitFor(() => expect(queryPanel()).toBeNull());

    fireEvent.click(screen.getByTestId("open-sheet"));
    const panel = queryPanel();
    const scrim = queryScrim();
    expect(panel).not.toBeNull();
    expect(scrim).not.toBeNull();
    expect(panel!.className).toContain("animate-hi-sheet-in");
    expect(scrim!.className).toContain("animate-hi-scrim-in");
    expect(panel!.style.transform).toBe("");
    expect(panel!.style.transition).toBe("");
    expect(panel!.style.animation).toBe("");
    expect(scrim!.style.opacity).toBe("");
  });
});
