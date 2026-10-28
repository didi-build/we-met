import { vi } from "vitest";

export const leadEmailCapacityAlwaysAllowed = {
  checkLeadEmailCapacity: vi.fn(async () => ({ allowed: true as const })),
  incrementDailySendCounts: vi.fn(async () => {}),
};

export const defaultLeadEmailControls = {
  leadEmailEnabled: true,
  visitorEmailMode: "direct" as const,
  dailyCapGlobal: 150,
  dailyCapPerCard: 50,
};

export const leadEmailControlsFixture = defaultLeadEmailControls;

export const readVisitorEmailModeDirect = async () => "direct" as const;

export const leadEmailConsumerEnabled = {
  readLeadEmailControls: vi.fn(async () => defaultLeadEmailControls),
};
