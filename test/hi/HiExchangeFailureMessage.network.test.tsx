import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HiExchangeFailureMessage } from "@/components/hi/HiExchangeFailureMessage";
import { exampleCardInput } from "../helpers/example-card";

describe("HiExchangeFailureMessage network variant", () => {
  it("renders the network error copy", () => {
    const copy = exampleCardInput().copy.exchangeSheet;
    const html = renderToStaticMarkup(
      <HiExchangeFailureMessage copy={copy} variant="network" />,
    );
    expect(html).toContain(copy.networkErrorMessage);
  });
});
