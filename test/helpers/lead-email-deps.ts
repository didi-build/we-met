import { vi } from "vitest";

export const leadEmailCapacityAlwaysAllowed = {
  assertLeadEmailCapacity: vi.fn(async () => true),
  incrementDailySendCounts: vi.fn(async () => {}),
};

export const defaultLeadEmailControls = {
  leadEmailEnabled: true,
  emailProvider: "gmail" as const,
  dailyCapGlobal: 150,
  dailyCapPerCard: 50,
};

export const leadEmailConsumerEnabled = {
  readLeadEmailControls: vi.fn(async () => defaultLeadEmailControls),
};
