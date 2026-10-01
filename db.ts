import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
export interface Store {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]>;
  transaction<T>(fn: (tx: Store) => Promise<T>): Promise<T>;
}
const globalDb = globalThis as unknown as { nehirDb?: Promise<Store> };
function wrapPg(client: ReturnType<typeof postgres>): Store {
  return {
    async query<T extends Record<string, unknown>>(
      text: string,
      values: unknown[] = [],
    ) {
      return Array.from(
        await client.unsafe(
          text,
          values as Parameters<typeof client.unsafe>[1],
        ),
      ) as unknown as T[];
    },
    async transaction<T>(fn: (tx: Store) => Promise<T>) {
      return (await client.begin(async (tx) =>
        fn(wrapPg(tx as unknown as ReturnType<typeof postgres>)),
      )) as T;
    },
  };
}
async function initialize(): Promise<Store> {
  let db: Store;
  if (process.env.DATABASE_URL) {
    db = wrapPg(
      postgres(process.env.DATABASE_URL, {
        max: process.env.VERCEL ? 1 : 5,
        prepare: false,
        idle_timeout: 20,
        connect_timeout: 15,
      }),
    );
  } else {
    if (
      process.env.VERCEL ||
      (process.env.NODE_ENV === "production" &&
        process.env.REQUIRE_EXTERNAL_DATABASE === "true")
    )
      throw new Error("DATABASE_URL gerekli");
    const memory = process.env.LOCAL_DATABASE_PATH === ":memory:";
    const dir = path.resolve(
      process.env.LOCAL_DATABASE_PATH || ".local/database",
    );
    if (!memory) await mkdir(dir, { recursive: true });
    const pg = new PGlite(memory ? undefined : dir);
    await pg.waitReady;
    db = {
      async query<T extends Record<string, unknown>>(
        sql: string,
        params: unknown[] = [],
      ) {
        return (await pg.query<T>(sql, params)).rows;
      },
      transaction: (fn) =>
        pg.transaction((tx) =>
          fn({
            query: async <T extends Record<string, unknown>>(
              sql: string,
              params: unknown[] = [],
            ) => (await tx.query<T>(sql, params)).rows,
            transaction: async () => {
              throw new Error("Nested transaction unsupported");
            },
          }),
        ),
    };
  }
  // Vercel instances only connect; run db:migrate once before deployment.
  if (!process.env.DATABASE_URL) await migrateDatabase(db);
  return db;
}
export async function migrateDatabase(db: Store) {
  const schema = await readFile(
    path.join(process.cwd(), "database/schema.sql"),
    "utf8",
  );
  // The migration contains no user data and is safe to rerun.
  if (process.env.DATABASE_URL) {
    for (const statement of schema.split(";").filter((s) => s.trim()))
      await db.query(statement);
  } else {
    // query supports one statement, split this controlled migration.
    for (const statement of schema.split(";").filter((s) => s.trim()))
      await db.query(statement);
  }
  const { seed } = await import("../database/seed-data");
  await seed(db);
}
export function database(): Promise<Store> {
  return (globalDb.nehirDb ??= initialize().catch((error) => {
    globalDb.nehirDb = undefined;
    throw error;
  }));
}
export async function query<
  T extends Record<string, unknown> = Record<string, unknown>,
>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await database()).query<T>(sql, params);
}
export const uuid = () => crypto.randomUUID();
