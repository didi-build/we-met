/** @vitest-environment jsdom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "../src/app/globals.css";
import { galleryEntries } from "../gallery/registry";

describe("gallery registry render (unit)", () => {
  afterEach(() => {
    cleanup();
  });

  for (const entry of galleryEntries) {
    for (const variant of entry.variants) {
      it(`renders ${entry.id} variant ${variant.name}`, () => {
        const Component = entry.component;
        const { container } = render(<Component {...variant.props} />);
        expect(container.textContent?.trim().length ?? 0).toBeGreaterThan(0);
      });
    }
  }
});
