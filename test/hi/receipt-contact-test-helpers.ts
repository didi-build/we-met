import { screen } from "@testing-library/react";
import { expect } from "vitest";

export const RECEIPT_CONTACT_PLACEHOLDER_SELECTOR =
  "span.min-h-12.rounded-pill.border.border-dashed.border-line";

export function receiptContactPlaceholders(root: ParentNode = document): Element[] {
  return Array.from(root.querySelectorAll(RECEIPT_CONTACT_PLACEHOLDER_SELECTOR));
}

export function visitorReceiptContactGrid(): HTMLElement | null {
  const saveButton =
    screen.queryByRole("button", { name: /Save .* contact/i }) ??
    screen.queryByRole("button", { name: /Saved, tap to save again/i });
  if (!saveButton) {
    return null;
  }
  const receiptRoot = saveButton.closest(".animate-hi-fade");
  return receiptRoot?.querySelector(":scope > .grid.grid-cols-2") ?? null;
}

export function isReceiptContactPlaceholder(el: Element): boolean {
  return (
    el.tagName === "SPAN" &&
    el.getAttribute("aria-hidden") === "true" &&
    el.classList.contains("border-dashed")
  );
}

export function expectNoVisitorReceiptContactRow(): void {
  expect(screen.queryByRole("link", { name: /^Email$/i })).toBeNull();
  expect(screen.queryByRole("link", { name: /^Call$/i })).toBeNull();
  expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
  expect(document.querySelector('a[href^="tel:"]')).toBeNull();
  expect(visitorReceiptContactGrid()).toBeNull();
  expect(receiptContactPlaceholders()).toHaveLength(0);
}
