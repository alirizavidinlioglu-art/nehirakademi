import { randomBytes } from "node:crypto";
import { mkdir, writeFile, access } from "node:fs/promises";
import bcrypt from "bcryptjs";
import { database, uuid } from "../lib/db";
if (process.env.DATABASE_URL || process.env.NODE_ENV === "production")
  throw new Error(
    "Development accounts are only supported with the local development database.",
  );
const file = ".local/development-accounts.json";
try {
  await access(file);
  console.log("Existing development credentials preserved at " + file);
  process.exit(0);
} catch {}
const db = await database();
const accounts: {
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "PARENT" | "ADMIN";
  password: string;
}[] = [];
for (const [name, email, role] of [
  ["Nehir", "nehir@example.test", "STUDENT"],
  ["Ebeveyn", "parent@example.test", "PARENT"],
  ["Yönetici", "admin@example.test", "ADMIN"],
] as const) {
  const existing = await db.query("SELECT id FROM users WHERE email=$1", [
    email,
  ]);
  if (existing.length)
    throw new Error(
      "Account already exists; credentials will not be replaced.",
    );
  accounts.push({
    id: uuid(),
    name,
    email,
    role,
    password: randomBytes(18).toString("base64url"),
  });
}
await db.transaction(async (tx) => {
  for (const a of accounts) {
    await tx.query(
      "INSERT INTO users(id,name,email,role,password_hash) VALUES($1,$2,$3,$4,$5)",
      [a.id, a.name, a.email, a.role, await bcrypt.hash(a.password, 12)],
    );
    if (a.role === "STUDENT")
      await tx.query("INSERT INTO student_profiles(user_id) VALUES($1)", [
        a.id,
      ]);
    if (a.role === "PARENT")
      await tx.query("INSERT INTO parent_profiles(user_id) VALUES($1)", [a.id]);
  }
  await tx.query(
    "INSERT INTO parent_student_links(parent_id,student_id) VALUES($1,$2)",
    [accounts[1].id, accounts[0].id],
  );
});
await mkdir(".local", { recursive: true });
await writeFile(file, JSON.stringify(accounts, null, 2), {
  mode: 0o600,
  flag: "wx",
});
console.log(
  "Development accounts created. Credentials stored privately at " +
    file +
    "; no passwords logged.",
);
process.exit(0);
