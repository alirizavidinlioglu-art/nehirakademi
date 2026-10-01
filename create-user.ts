import bcrypt from "bcryptjs";
import { database, uuid } from "../lib/db";
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const i = a.indexOf("=");
    return [a.slice(0, i).replace(/^--/, ""), a.slice(i + 1)];
  }),
);
if (
  !args.email ||
  !args.name ||
  !["STUDENT", "PARENT", "ADMIN"].includes(args.role) ||
  !process.env.BOOTSTRAP_PASSWORD ||
  process.env.BOOTSTRAP_PASSWORD.length < 12
)
  throw new Error(
    "Use --email=... --name=... --role=... and BOOTSTRAP_PASSWORD (12+ characters).",
  );
const db = await database();
const id = uuid();
await db.query(
  "INSERT INTO users(id,email,name,role,password_hash) VALUES($1,$2,$3,$4,$5)",
  [
    id,
    args.email.toLowerCase(),
    args.name,
    args.role,
    await bcrypt.hash(process.env.BOOTSTRAP_PASSWORD, 12),
  ],
);
if (args.role === "STUDENT")
  await db.query("INSERT INTO student_profiles(user_id) VALUES($1)", [id]);
if (args.role === "PARENT")
  await db.query("INSERT INTO parent_profiles(user_id) VALUES($1)", [id]);
console.log("User created:", args.email, args.role);
process.exit(0);
