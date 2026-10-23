// @vitest-environment jsdom

import { HiVisitorReceipt } from "@/components/hi/HiVisitorReceipt";
import { createDetailsToken } from "@/exchange/token";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("HiVisitorReceipt (component)", () => {
  const leadToken = createDetailsToken(
    "hi-receipt-test-secret",
    {
      leadId: "lead-1",
      cardId: "card-1",
      cardSlug: "maya-card",
      visitorEmail: "sam@example.com",
      visitorName: "Sam",
    },
    Math.floor(Date.now() / 1000),
  );

  const baseProps = {
    slug: "maya-card",
    ownerFirst: "Maya",
    visitorFirst: "Sam",
    ownerContact: { email: "maya@example.com", phone: "+1 416 555 0142" },
    leadToken,
    detailsSent: false,
    vcardSaveResetSignal: 0,
    onTellMore: vi.fn(),
    onVcardFailure: vi.fn(),
  };

  it("renders save contact as a top-level form POST with token and slug", () => {
    render(<HiVisitorReceipt {...baseProps} />);

    const form = screen
      .getByRole("button", { name: /Save Maya's contact/i })
      .closest("form");
    expect(form).toBeTruthy();
    expect(form?.getAttribute("method")?.toLowerCase()).toBe("post");
    expect(form?.getAttribute("action")).toBe("/api/exchange/vcard");
    expect(form?.getAttribute("target")).toBe("_self");
    expect(form?.querySelector('input[name="token"]')?.getAttribute("value")).toBe(
      leadToken,
    );
    expect(form?.querySelector('input[name="slug"]')?.getAttribute("value")).toBe(
      "maya-card",
    );
  });

  it("calls requestSubmit after the busy delay so the native POST proceeds", async () => {
    vi.useFakeTimers();
    const requestSubmit = vi
      .spyOn(HTMLFormElement.prototype, "requestSubmit")
      .mockImplementation(() => {});

    render(<HiVisitorReceipt {...baseProps} />);

    const form = screen
      .getByRole("button", { name: /Save Maya's contact/i })
      .closest("form");
    expect(form).toBeTruthy();
    fireEvent.submit(form!);
    expect(requestSubmit).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(requestSubmit).toHaveBeenCalledTimes(1);

    requestSubmit.mockRestore();
  });

  it("does not prevent default on the native submit pass", async () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLFormElement.prototype, "requestSubmit").mockImplementation(
      function requestSubmit(this: HTMLFormElement) {
        fireEvent.submit(this);
      },
    );

    render(<HiVisitorReceipt {...baseProps} />);
    const form = screen
      .getByRole("button", { name: /Save Maya's contact/i })
      .closest("form") as HTMLFormElement;
    fireEvent.submit(form);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    const preventDefault = vi.spyOn(Event.prototype, "preventDefault");
    fireEvent.submit(form);
    expect(preventDefault).not.toHaveBeenCalled();
    preventDefault.mockRestore();
  });

  it("shows Saved after save-again without waiting on navigation", async () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLFormElement.prototype, "requestSubmit").mockImplementation(() => {});

    render(<HiVisitorReceipt {...baseProps} />);
    const form = screen
      .getByRole("button", { name: /Save Maya's contact/i })
      .closest("form")!;
    fireEvent.submit(form);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    fireEvent.submit(form);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(
      screen.getByRole("button", { name: /Saved, tap to save again/i }),
    ).toBeTruthy();
  });

  it("resets the save button when vcardSaveResetSignal changes", async () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLFormElement.prototype, "requestSubmit").mockImplementation(() => {});

    const { rerender } = render(<HiVisitorReceipt {...baseProps} />);
    const form = screen
      .getByRole("button", { name: /Save Maya's contact/i })
      .closest("form")!;
    fireEvent.submit(form);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    fireEvent.submit(form);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    expect(
      screen.getByRole("button", { name: /Saved, tap to save again/i }),
    ).toBeTruthy();

    rerender(<HiVisitorReceipt {...baseProps} vcardSaveResetSignal={1} />);
    expect(screen.getByRole("button", { name: /Save Maya's contact/i })).toBeTruthy();
  });

  it("hides the email and call row when owner contact is unknown after reload", () => {
    render(<HiVisitorReceipt {...baseProps} ownerContact={null} />);
    expect(screen.queryByRole("link", { name: /Email/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Call/i })).toBeNull();
  });

  it("omits the email button and shows a phone placeholder when email is missing", () => {
    render(
      <HiVisitorReceipt
        {...baseProps}
        ownerContact={{ email: "", phone: "+1 416 555 0142" }}
      />,
    );
    expect(screen.queryByRole("link", { name: /Email/i })).toBeNull();
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(screen.getByRole("link", { name: /Call/i }).getAttribute("href")).toMatch(
      /^tel:/,
    );
  });

  it("shows after-details copy when details were sent", () => {
    render(<HiVisitorReceipt {...baseProps} detailsSent={true} />);
    expect(screen.getByText(/Your details were added. Thanks, Sam\./)).toBeTruthy();
    expect(screen.getByText("With your note")).toBeTruthy();
  });
});
