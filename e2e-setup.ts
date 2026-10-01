import { randomBytes } from "node:crypto";
import { rm, mkdir, writeFile } from "node:fs/promises";
import bcrypt from "bcryptjs";
import { database, uuid } from "../lib/db";
if (process.env.LOCAL_DATABASE_PATH !== ".local/e2e-database")
  throw new Error("E2E setup may only reset its dedicated database.");
await rm(".local/e2e-database", { recursive: true, force: true });
await rm(".local/e2e-mail-outbox", { recursive: true, force: true });
const db = await database();
const password = randomBytes(18).toString("base64url");
const fixtures: {
  password: string;
  users: Record<string, { id: string; email: string }>;
} = { password, users: {} };
for (const [key, name, role] of [
  ["student", "Nehir", "STUDENT"],
  ["other", "Başka öğrenci", "STUDENT"],
  ["parent", "Ebeveyn", "PARENT"],
  ["unlinked", "Bağlantısız ebeveyn", "PARENT"],
  ["admin", "Yönetici", "ADMIN"],
] as const) {
  const id = uuid(),
    email = key + "@e2e.example.test";
  await db.query(
    "INSERT INTO users(id,name,email,role,password_hash,preferences) VALUES($1,$2,$3,$4,$5,$6)",
    [
      id,
      name,
      email,
      role,
      await bcrypt.hash(password, 12),
      JSON.stringify({ onboarded: true }),
    ],
  );
  fixtures.users[key] = { id, email };
}
await db.query(
  "INSERT INTO parent_student_links(parent_id,student_id) VALUES($1,$2)",
  [fixtures.users.parent.id, fixtures.users.student.id],
);
await mkdir(".local", { recursive: true });
await writeFile(".local/e2e-fixtures.json", JSON.stringify(fixtures), {
  mode: 0o600,
});
console.log("Isolated E2E database prepared.");
process.exit(0);
