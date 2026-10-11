import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

function migrationStatements(): string[] {
  const dir = resolve("migrations");
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const statements: string[] = [];
  for (const file of files) {
    const sql = readFileSync(resolve(dir, file), "utf8");
    for (const chunk of sql.split(";")) {
      const statement = chunk.trim();
      if (statement) {
        statements.push(statement);
      }
    }
  }
  return statements;
}

async function runStatements(db: D1Database, statements: string[]): Promise<void> {
  for (const statement of statements) {
    await db.prepare(statement).run();
  }
}

/**
 * Isolated local D1 for tests. Uses a temporary persist directory (not `.wrangler/state`).
 * **UNVERIFIED:** Wrangler `getPlatformProxy({ persist: { path } })` is the documented Miniflare
 * persist option; confirm against current Wrangler release notes if local test behavior changes.
 */
export async function withIsolatedLocalD1<T>(
  fn: (db: D1Database) => Promise<T>,
): Promise<T> {
  const persistDir = mkdtempSync(resolve(tmpdir(), "we-met-d1-test-"));
  const { getPlatformProxy } = await import("wrangler");
  const proxy = await getPlatformProxy({
    configPath: resolve("wrangler.jsonc"),
    persist: { path: persistDir },
  });
  try {
    const db = proxy.env.WE_MET_DB as D1Database;
    if (!db) {
      throw new Error("WE_MET_DB is not configured for local tests");
    }
    await runStatements(db, migrationStatements());
    return await fn(db);
  } finally {
    await proxy.dispose?.();
    rmSync(persistDir, { recursive: true, force: true });
  }
}

/** @deprecated Use withIsolatedLocalD1 — avoids sharing the maintainer's default local D1. */
export async function withLocalD1<T>(fn: (db: D1Database) => Promise<T>): Promise<T> {
  return withIsolatedLocalD1(fn);
}
