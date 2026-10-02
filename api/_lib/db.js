import { neon } from "@neondatabase/serverless";

// Vercel's Postgres (Neon-backed) integration injects DATABASE_URL —
// POSTGRES_URL is kept as a fallback for a manually-linked Neon database.
const connectionString = (process.env.DATABASE_URL || process.env.POSTGRES_URL)?.trim();

if (!connectionString) {
  throw new Error(
    "No database connection string found. Set DATABASE_URL (or POSTGRES_URL) — see db/SETUP.md."
  );
}

const rawSql = neon(connectionString);

async function execWithRetry(fn) {
  let attempts = 0;
  while (attempts < 3) {
    try {
      return await fn();
    } catch (err) {
      attempts++;
      const isTransient =
        err?.sourceError?.code === "ENOTFOUND" ||
        err?.message?.includes("fetch failed") ||
        err?.message?.includes("ETIMEDOUT") ||
        err?.message?.includes("ECONNRESET");
      if (!isTransient || attempts >= 3) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 200 * attempts));
    }
  }
}

export const sql = new Proxy(rawSql, {
  apply(target, thisArg, args) {
    return execWithRetry(() => Reflect.apply(target, thisArg, args));
  },
  get(target, prop, receiver) {
    const val = Reflect.get(target, prop, receiver);
    if (typeof val === "function") {
      return (...args) => execWithRetry(() => val.apply(target, args));
    }
    return val;
  },
});
