import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { seed } from "../database/seed-data";
import type { Store } from "../lib/db";
let pg: PGlite;
let store: Store;
beforeAll(async () => {
  pg = new PGlite();
  await pg.waitReady;
  await pg.exec(await readFile("database/schema.sql", "utf8"));
  store = {
    query: async <T extends Record<string, unknown>>(
      sql: string,
      params: unknown[] = [],
    ) => (await pg.query<T>(sql, params)).rows,
    transaction: (fn) =>
      pg.transaction((tx) =>
        fn({
          query: async <T extends Record<string, unknown>>(
            sql: string,
            params: unknown[] = [],
          ) => (await tx.query<T>(sql, params)).rows,
          transaction: async () => {
            throw new Error("nested transaction");
          },
        }),
      ),
  };
});
afterAll(async () => {
  await pg.close();
});
describe("PostgreSQL schema and seed", () => {
  it("seeds twelve subjects, preserves rerun counts, and makes no unverified curriculum claims", async () => {
    await seed(store);
    const first = await store.query("SELECT count(*)::int n FROM questions");
    await seed(store);
    expect(
      (await store.query("SELECT count(*)::int n FROM questions"))[0].n,
    ).toBe(first[0].n);
    expect(
      (await store.query("SELECT count(*)::int n FROM subjects"))[0].n,
    ).toBe(12);
    expect(
      (
        await store.query(
          "SELECT count(*)::int n FROM curriculum_nodes WHERE verified=true",
        )
      )[0].n,
    ).toBe(0);
    expect(
      (
        await store.query(
          "SELECT count(*)::int n FROM questions WHERE status=$1",
          ["approved"],
        )
      )[0].n,
    ).toBe(134);
  });
  it("has correct authored answers and a single valid choice", async () => {
    const questions = await store.query(
      "SELECT * FROM questions WHERE origin=$1",
      ["original_seed"],
    );
    for (const q of questions) {
      const numbers = String(q.prompt).match(/-?\d+/g)!.map(Number);
      expect(Number(q.answer)).toBe(numbers[0] + numbers[1]);
      if (q.options) {
        expect(
          (q.options as string[]).filter((o) => o === q.answer),
        ).toHaveLength(1);
      }
    }
  });
  it("rejects invalid roles and rolls back dependent changes", async () => {
    await expect(
      store.query(
        "INSERT INTO users(id,email,name,password_hash,role) VALUES($1,$2,$3,$4,$5)",
        [randomUUID(), "invalid@example.test", "Invalid", "hash", "SUPERADMIN"],
      ),
    ).rejects.toThrow();
    const id = randomUUID();
    await expect(
      store.transaction(async (tx) => {
        await tx.query(
          "INSERT INTO users(id,email,name,password_hash,role) VALUES($1,$2,$3,$4,$5)",
          [id, "rollback@example.test", "Rollback", "hash", "STUDENT"],
        );
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(
      await store.query("SELECT id FROM users WHERE id=$1", [id]),
    ).toHaveLength(0);
  });
  it("stores foreign keys and blocks duplicated attempts", async () => {
    const id = randomUUID(),
      test = randomUUID(),
      q = (await store.query("SELECT id,topic_id FROM questions LIMIT 1"))[0];
    await store.query(
      "INSERT INTO users(id,email,name,password_hash,role) VALUES($1,$2,$3,$4,$5)",
      [id, "attempt@example.test", "Attempt", "hash", "STUDENT"],
    );
    await store.query(
      "INSERT INTO tests(id,student_id,title,topic_id) VALUES($1,$2,$3,$4)",
      [test, id, "Test", q.topic_id],
    );
    const sql =
      "INSERT INTO question_attempts(id,test_id,question_id,student_id,correct,response_ms) VALUES($1,$2,$3,$4,true,5000)";
    await store.query(sql, [randomUUID(), test, q.id, id]);
    await expect(
      store.query(sql, [randomUUID(), test, q.id, id]),
    ).rejects.toThrow();
    await expect(
      store.query(
        "INSERT INTO parent_student_links(parent_id,student_id) VALUES($1,$2)",
        [randomUUID(), id],
      ),
    ).rejects.toThrow();
  });
});
