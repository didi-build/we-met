import { vi } from "vitest";

export const leadEmailCapacityAlwaysAllowed = {
  assertLeadEmailCapacity: vi.fn(async () => true),
  incrementDailySendCounts: vi.fn(async () => {}),
};

export const leadEmailConsumerEnabled = {
  isLeadEmailEnabled: vi.fn(async () => true),
};
