/** Hourly cron; ~730 ticks per average month. */
export const WARMUP_HOURS_PER_MONTH = 730;

/** Product target from DIDI-709 / DIDI-694. */
export const WARMUP_TARGET_SENDS_PER_MONTH = 200;

export const WARMUP_SEND_PROBABILITY_PER_TICK =
  WARMUP_TARGET_SENDS_PER_MONTH / WARMUP_HOURS_PER_MONTH;

export const WARMUP_SEND_PROBABILITY_BOUNDS = {
  min: 0.2,
  max: 0.35,
} as const;

export function shouldSendThisTick(randomUnit: number): boolean {
  return randomUnit < WARMUP_SEND_PROBABILITY_PER_TICK;
}

export function expectedMonthlySendsFromProbability(
  probability: number,
  hoursPerMonth = WARMUP_HOURS_PER_MONTH,
): number {
  return probability * hoursPerMonth;
}
