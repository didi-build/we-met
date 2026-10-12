import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HiExchangeFailureMessage } from "@/components/hi/HiExchangeFailureMessage";
import { exampleCardInput } from "../helpers/example-card";

describe("HiExchangeFailureMessage", () => {
  it("renders a mailto link for the fallback contact path", () => {
    const copy = exampleCardInput().copy.exchangeSheet;
    const html = renderToStaticMarkup(<HiExchangeFailureMessage copy={copy} />);
    expect(html).toContain(`mailto:${copy.exchangeNotSavedEmail}`);
    expect(html).toContain(copy.exchangeNotSavedPrefix.trim());
  });
});
