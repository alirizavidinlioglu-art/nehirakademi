import { database } from "../lib/db";
import { seed } from "./seed-data";
await seed(await database());
console.log("Seed completed.");
process.exit(0);
