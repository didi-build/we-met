import { splitSqlStatements } from "@/card-data/sql-statements";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

export { ISOLATED_LOCAL_D1_TEST_TIMEOUT_MS } from "./isolated-local-d1-timeout";

function migrationStatements(): string[] {
  const dir = resolve("migrations");
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const statements: string[] = [];
  for (const file of files) {
    const sql = readFileSync(resolve(dir, file), "utf8");
    statements.push(...splitSqlStatements(sql));
  }
  return statements;
}

async function runStatements(db: D1Database, statements: string[]): Promise<void> {
  for (const statement of statements) {
    await db.prepare(statement).run();
  }
}

export type IsolatedLocalD1Handle = {
  db: D1Database;
  close: () => Promise<void>;
};

/** Clears migrated D1 tables between integration tests sharing one database. */
export async function clearLocalD1Tables(db: D1Database): Promise<void> {
  await db.prepare("DELETE FROM lead_delivery_ledger").run();
  await db.prepare("DELETE FROM exchange_owner_email").run();
  await db.prepare("DELETE FROM lead_sinks").run();
  await db.prepare("DELETE FROM hostnames").run();
  await db.prepare("DELETE FROM photo_upload_log").run();
  await db.prepare("DELETE FROM card_drafts").run();
  await db.prepare("DELETE FROM cards").run();
  await db.prepare("DELETE FROM contacts_oauth_attempts").run();
  await db.prepare("DELETE FROM oauth_attempts").run();
  await db.prepare("DELETE FROM sessions").run();
  await db.prepare("DELETE FROM accounts").run();
}

type OpenIsolatedLocalD1Options = {
  migrate?: boolean;
};

/**
 * Isolated local D1 for tests. Uses a temporary persist directory (not `.wrangler/state`).
 * **UNVERIFIED:** Wrangler `getPlatformProxy({ persist: { path } })` is the documented Miniflare
 * persist option; confirm against current Wrangler release notes if local test behavior changes.
 * Integration suites set Vitest testTimeout to ISOLATED_LOCAL_D1_TEST_TIMEOUT_MS
 * (see test/helpers/isolated-local-d1-timeout.ts).
 */
export async function openIsolatedLocalD1(
  options: OpenIsolatedLocalD1Options = {},
): Promise<IsolatedLocalD1Handle> {
  const { migrate = true } = options;
  const persistDir = mkdtempSync(resolve(tmpdir(), "we-met-d1-test-"));
  const { getPlatformProxy } = await import("wrangler");
  const proxy = await getPlatformProxy({
    configPath: resolve("wrangler.jsonc"),
    persist: { path: persistDir },
  });
  const db = proxy.env.WE_MET_DB as D1Database;
  if (!db) {
    await proxy.dispose?.();
    rmSync(persistDir, { recursive: true, force: true });
    throw new Error("WE_MET_DB is not configured for local tests");
  }
  if (migrate) {
    await runStatements(db, migrationStatements());
  }
  return {
    db,
    async close() {
      await proxy.dispose?.();
      rmSync(persistDir, { recursive: true, force: true });
    },
  };
}

async function withIsolatedD1Proxy<T>(
  fn: (db: D1Database) => Promise<T>,
  prepare?: (db: D1Database) => Promise<void>,
): Promise<T> {
  const handle = await openIsolatedLocalD1({ migrate: false });
  try {
    if (prepare) {
      await prepare(handle.db);
    }
    return await fn(handle.db);
  } finally {
    await handle.close();
  }
}

export async function withIsolatedLocalD1<T>(
  fn: (db: D1Database) => Promise<T>,
): Promise<T> {
  const handle = await openIsolatedLocalD1();
  try {
    return await fn(handle.db);
  } finally {
    await handle.close();
  }
}

export async function withEmptyIsolatedLocalD1<T>(
  fn: (db: D1Database) => Promise<T>,
): Promise<T> {
  return withIsolatedD1Proxy(fn);
}

/** @deprecated Use withIsolatedLocalD1 — avoids sharing the maintainer's default local D1. */
export async function withLocalD1<T>(fn: (db: D1Database) => Promise<T>): Promise<T> {
  return withIsolatedLocalD1(fn);
}
