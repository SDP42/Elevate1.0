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
const connectionString = (process.env.DATABASE_URL || process.env.POSTGRES_URL)?.trim();

if (!connectionString) {
  console.error("Set DATABASE_URL (or POSTGRES_URL) before running this script — see db/SETUP.md.");
  process.exit(1);
}

const sql = neon(connectionString);
const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");

// Split on a semicolon at the end of a line — except inside a $$ ... $$
// dollar-quoted body (a DO block), whose own internal semicolons must
// stay part of the same statement.
function splitStatements(text) {
  const lines = text.split("\n");
  const statements = [];
  let current = [];
  let inDollarBlock = false;

  for (const line of lines) {
    current.push(line);
    const dollarCount = (line.match(/\$\$/g) || []).length;
    if (dollarCount % 2 === 1) inDollarBlock = !inDollarBlock;

    if (!inDollarBlock && /;\s*$/.test(line)) {
      statements.push(current.join("\n"));
      current = [];
    }
  }
  if (current.some((l) => l.trim())) statements.push(current.join("\n"));

  return statements.map((s) => s.trim()).filter(Boolean);
}

const statements = splitStatements(schema);

async function executeWithRetry(fn) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === 4) throw err;
      await new Promise((r) => setTimeout(r, 250 * attempt));
    }
  }
}

async function main() {
  for (const statement of statements) {
    await executeWithRetry(() => sql.query(statement));
  }
  console.log(`Applied ${statements.length} statements from schema.sql.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
