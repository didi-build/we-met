// @vitest-environment jsdom

import { HiVisitorReceipt } from "@/components/hi/HiVisitorReceipt";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("HiVisitorReceipt (component)", () => {
  it("renders save contact as a form POST with the lead token", () => {
    render(
      <HiVisitorReceipt
        ownerFirst="Maya"
        visitorFirst="Sam"
        ownerContact={{ email: "maya@example.com", phone: "+1 416 555 0142" }}
        leadToken="secret-lead-token"
        detailsSent={false}
        onTellMore={vi.fn()}
        onVcardFailure={vi.fn()}
      />,
    );

    const form = screen
      .getByRole("button", { name: /Save Maya's contact/i })
      .closest("form");
    expect(form).toBeTruthy();
    expect(form?.getAttribute("method")?.toLowerCase()).toBe("post");
    expect(form?.getAttribute("action")).toBe("/api/exchange/vcard");
    expect(form?.getAttribute("target")).toBeTruthy();
    const tokenInput = form?.querySelector('input[name="token"]');
    expect(tokenInput?.getAttribute("value")).toBe("secret-lead-token");
  });

  it("calls requestSubmit after the busy delay so the native POST proceeds", async () => {
    vi.useFakeTimers();
    const requestSubmit = vi
      .spyOn(HTMLFormElement.prototype, "requestSubmit")
      .mockImplementation(() => {});

    render(
      <HiVisitorReceipt
        ownerFirst="Maya"
        visitorFirst="Sam"
        ownerContact={{ email: "maya@example.com", phone: "" }}
        leadToken="token"
        detailsSent={false}
        onTellMore={vi.fn()}
        onVcardFailure={vi.fn()}
      />,
    );

    const form = screen
      .getByRole("button", { name: /Save Maya's contact/i })
      .closest("form");
    expect(form).toBeTruthy();
    fireEvent.submit(form!);
    expect(requestSubmit).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(400);
    expect(requestSubmit).toHaveBeenCalledTimes(1);

    requestSubmit.mockRestore();
  });

  it("hides the email and call row when owner contact is unknown after reload", () => {
    render(
      <HiVisitorReceipt
        ownerFirst="Maya"
        visitorFirst="Sam"
        ownerContact={null}
        leadToken="token"
        detailsSent={false}
        onTellMore={vi.fn()}
        onVcardFailure={vi.fn()}
      />,
    );
    expect(screen.queryByRole("link", { name: /Email/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Call/i })).toBeNull();
  });

  it("shows after-details copy when details were sent", () => {
    render(
      <HiVisitorReceipt
        ownerFirst="Maya"
        visitorFirst="Sam"
        ownerContact={{ email: "maya@example.com", phone: "" }}
        leadToken="token"
        detailsSent={true}
        onTellMore={vi.fn()}
        onVcardFailure={vi.fn()}
      />,
    );
    expect(screen.getByText(/Your details were added. Thanks, Sam\./)).toBeTruthy();
    expect(screen.getByText("With your note")).toBeTruthy();
  });
});
