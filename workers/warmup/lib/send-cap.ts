import type { WarmupEnv } from "./config";

/** Hard ceiling above the ~200/month product target (DIDI-709). */
export const WARMUP_MAX_SENDS_PER_DAY = 15;

export const WARMUP_MAX_SENDS_PER_MONTH = 220;

function dayKey(isoDate: string): string {
  return `cap:day:${isoDate}`;
}

function monthKey(yearMonth: string): string {
  return `cap:month:${yearMonth}`;
}

export function warmupCapKeysForDate(date: Date): { day: string; month: string } {
  const isoDay = date.toISOString().slice(0, 10);
  const yearMonth = isoDay.slice(0, 7);
  return { day: dayKey(isoDay), month: monthKey(yearMonth) };
}

async function readCount(kv: KVNamespace, key: string): Promise<number | null> {
  try {
    const raw = await kv.get(key);
    if (raw === null) {
      return 0;
    }
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) {
      return null;
    }
    return n;
  } catch {
    return null;
  }
}

export type SendCapCheckResult =
  | { ok: true; dayCount: number; monthCount: number }
  | {
      ok: false;
      reason: "missing_kv" | "kv_read_failed" | "daily_cap" | "monthly_cap";
      dayCount?: number;
      monthCount?: number;
    };

export async function checkWarmupSendCap(
  env: Pick<WarmupEnv, "WARMUP_STATE">,
  now: Date = new Date(),
): Promise<SendCapCheckResult> {
  const kv = env.WARMUP_STATE;
  if (!kv) {
    return { ok: false, reason: "missing_kv" };
  }
  const keys = warmupCapKeysForDate(now);
  const dayCount = await readCount(kv, keys.day);
  const monthCount = await readCount(kv, keys.month);
  if (dayCount === null || monthCount === null) {
    return { ok: false, reason: "kv_read_failed" };
  }
  if (dayCount >= WARMUP_MAX_SENDS_PER_DAY) {
    return { ok: false, reason: "daily_cap", dayCount, monthCount };
  }
  if (monthCount >= WARMUP_MAX_SENDS_PER_MONTH) {
    return { ok: false, reason: "monthly_cap", dayCount, monthCount };
  }
  return { ok: true, dayCount, monthCount };
}

export async function recordWarmupSuccessfulSend(
  env: Pick<WarmupEnv, "WARMUP_STATE">,
  now: Date = new Date(),
): Promise<boolean> {
  const kv = env.WARMUP_STATE;
  if (!kv) {
    return false;
  }
  const keys = warmupCapKeysForDate(now);
  try {
    const dayCount = (await readCount(kv, keys.day)) ?? 0;
    const monthCount = (await readCount(kv, keys.month)) ?? 0;
    await kv.put(keys.day, String(dayCount + 1));
    await kv.put(keys.month, String(monthCount + 1));
    return true;
  } catch {
    return false;
  }
}
