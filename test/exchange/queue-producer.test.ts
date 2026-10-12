import { describe, expect, it } from "vitest";
import {
  MissingQueueBindingError,
  requireQueueBinding,
} from "@/exchange/queue/producer";

describe("queue producer binding (unit)", () => {
  it("fails loudly when the follow-up queue binding is missing", () => {
    expect(() => requireQueueBinding(undefined, "WE_MET_FOLLOWUP_EMAIL_QUEUE")).toThrow(
      MissingQueueBindingError,
    );
  });
});
