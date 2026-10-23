// @vitest-environment jsdom

import { HiVisitorConfirmationReceipt } from "@/components/hi/HiVisitorConfirmationReceipt";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
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
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("HiVisitorConfirmationReceipt (unit)", () => {
  it("renders receipt actions before optional details", () => {
    const onTellMore = vi.fn();
    render(
      <ThemeProvider>
        <HiVisitorConfirmationReceipt
          ownerName="Maya Chen"
          ownerEmail="maya@northwind.studio"
          ownerPhone="+1 416 555 0142"
          visitorFirstName="Sam"
          detailsAdded={false}
          onTellMore={onTellMore}
          onSaveContact={() => {}}
        />
      </ThemeProvider>,
    );

    expect(screen.getByText(/Sent to Maya/i)).toBeTruthy();
    expect(screen.getByText("Just now")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Save Maya's contact/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Email/i }).getAttribute("href")).toBe(
      "mailto:maya@northwind.studio",
    );
    expect(screen.getByRole("link", { name: /Call/i }).getAttribute("href")).toBe(
      "tel:+14165550142",
    );
    fireEvent.click(screen.getByRole("button", { name: /Tell Maya more about you/i }));
    expect(onTellMore).toHaveBeenCalledOnce();
  });

  it("shows after-details copy when details were added", () => {
    render(
      <ThemeProvider>
        <HiVisitorConfirmationReceipt
          ownerName="Maya Chen"
          ownerEmail="maya@northwind.studio"
          visitorFirstName="Sam"
          detailsAdded
          onTellMore={() => {}}
          onSaveContact={() => {}}
        />
      </ThemeProvider>,
    );

    expect(screen.getByText("With your note")).toBeTruthy();
    expect(screen.getByText(/Your details were added. Thanks, Sam/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Tell Maya more/i })).toBeNull();
  });
});
