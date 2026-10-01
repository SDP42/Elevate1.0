// Applies db/schema.sql to the database at DATABASE_URL. Safe to re-run —
// every statement in schema.sql is written to be idempotent
// (create-if-not-exists, insert-on-conflict-do-nothing).
//
//   node db/migrate.mjs

import { neon } from "@neondatabase/serverless";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
  console.error("Set DATABASE_URL (or POSTGRES_URL) before running this script — see db/SETUP.md.");
  process.exit(1);
}

const sql = neon(connectionString);
const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");

// Split on a semicolon at the end of a line — none of our statements use
// dollar-quoted bodies, so this is safe here.
const statements = schema
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter(Boolean);

async function main() {
  for (const statement of statements) {
    await sql.query(statement);
  }
  console.log(`Applied ${statements.length} statements from schema.sql.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
