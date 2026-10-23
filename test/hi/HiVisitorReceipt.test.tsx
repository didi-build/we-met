// @vitest-environment jsdom

import { HiVisitorReceipt } from "@/components/hi/HiVisitorReceipt";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
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
      />,
    );

    const form = screen
      .getByRole("button", { name: /Save Maya's contact/i })
      .closest("form");
    expect(form).toBeTruthy();
    expect(form?.getAttribute("method")?.toLowerCase()).toBe("post");
    expect(form?.getAttribute("action")).toBe("/api/exchange/vcard");
    const tokenInput = form?.querySelector('input[name="token"]');
    expect(tokenInput?.getAttribute("value")).toBe("secret-lead-token");
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
      />,
    );
    expect(screen.getByText(/Your details were added. Thanks, Sam\./)).toBeTruthy();
    expect(screen.getByText("With your note")).toBeTruthy();
  });
});
