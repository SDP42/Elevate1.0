import { neon } from "@neondatabase/serverless";

// Vercel's Postgres (Neon-backed) integration injects DATABASE_URL —
// POSTGRES_URL is kept as a fallback for a manually-linked Neon database.
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error(
    "No database connection string found. Set DATABASE_URL (or POSTGRES_URL) — see db/SETUP.md."
  );
}

export const sql = neon(connectionString);
