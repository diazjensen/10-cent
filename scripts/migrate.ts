// Applies db/schema.sql to the database at DATABASE_URL (safe to re-run: every statement is IF NOT EXISTS).
import fs from "node:fs";
import path from "node:path";
import { pgdb as db } from "../src/lib/pg";

async function main() {
  const sql = fs.readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf8");
  await db.exec(sql);
  console.log("Schema applied.");
  await db.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
