import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

let proxyPromise: Promise<{
  db: D1Database;
  dispose: () => Promise<void>;
}> | null = null;

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

async function getSharedLocalD1(): Promise<D1Database> {
  if (!proxyPromise) {
    proxyPromise = (async () => {
      const { getPlatformProxy } = await import("wrangler");
      const proxy = await getPlatformProxy({
        configPath: resolve("wrangler.jsonc"),
      });
      const db = proxy.env.WE_MET_DB as D1Database;
      if (!db) {
        throw new Error("WE_MET_DB is not configured for local tests");
      }
      for (const statement of migrationStatements()) {
        await db.prepare(statement).run();
      }
      return {
        db,
        dispose: async () => {
          await proxy.dispose?.();
        },
      };
    })();
  }
  const shared = await proxyPromise;
  return shared.db;
}

export async function withLocalD1<T>(fn: (db: D1Database) => Promise<T>): Promise<T> {
  const db = await getSharedLocalD1();
  return fn(db);
}
