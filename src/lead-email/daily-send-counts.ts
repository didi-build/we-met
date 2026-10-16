import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";

export type DailySendKind = "owner" | "visitor";

export function utcDayFromDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function incrementDailySendStatements(
  db: D1Database,
  day: string,
  cardId: string,
  kinds: readonly DailySendKind[],
): D1PreparedStatement[] {
  return kinds.map((kind) =>
    db
      .prepare(
        `INSERT INTO daily_send_counts (day, card_id, kind, count)
         VALUES (?, ?, ?, 1)
         ON CONFLICT(day, card_id, kind) DO UPDATE SET count = count + 1`,
      )
      .bind(day, cardId, kind),
  );
}

export async function sumGlobalDailySendCount(
  db: D1Database,
  day: string,
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(count), 0) AS total
       FROM daily_send_counts
       WHERE day = ?`,
    )
    .bind(day)
    .first<{ total: number }>();
  return row?.total ?? 0;
}

export async function sumCardDailySendCount(
  db: D1Database,
  cardId: string,
  day: string,
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(count), 0) AS total
       FROM daily_send_counts
       WHERE day = ? AND card_id = ?`,
    )
    .bind(day, cardId)
    .first<{ total: number }>();
  return row?.total ?? 0;
}

export async function incrementDailySendCounts(
  db: D1Database,
  day: string,
  cardId: string,
  kinds: readonly DailySendKind[],
): Promise<void> {
  if (kinds.length === 0) {
    return;
  }
  await db.batch(incrementDailySendStatements(db, day, cardId, kinds));
}
