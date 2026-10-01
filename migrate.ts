import { database, migrateDatabase } from "../lib/db";
const db = await database();
if (process.env.DATABASE_URL) await migrateDatabase(db);
console.log("Migration and idempotent seed completed.");
process.exit(0);
