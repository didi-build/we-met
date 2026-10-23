import { vi } from "vitest";

export const leadEmailCapacityAlwaysAllowed = {
  assertLeadEmailCapacity: vi.fn(async () => true),
  incrementDailySendCounts: vi.fn(async () => {}),
};

export const defaultLeadEmailControls = {
  leadEmailEnabled: true,
  visitorEmailMode: "direct" as const,
  dailyCapGlobal: 150,
  dailyCapPerCard: 50,
};

export const readVisitorEmailModeDirect = async () => "direct" as const;

export const leadEmailConsumerEnabled = {
  readLeadEmailControls: vi.fn(async () => defaultLeadEmailControls),
};
