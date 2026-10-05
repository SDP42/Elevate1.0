// Explicit cleanup for databases that previously used the hardening branch.
// Deploy the new API first; then run with --confirm-remove-plaintext-passwords.
// Existing bcrypt hashes remain valid. This permanently removes stored plaintext.
import { neon } from "@neondatabase/serverless";
if (!process.argv.includes("--confirm-remove-plaintext-passwords")) {
  throw new Error("Explicit confirmation flag required: --confirm-remove-plaintext-passwords");
}
const connectionString = (process.env.DATABASE_URL || process.env.POSTGRES_URL)?.trim();
if (!connectionString) throw new Error("Set DATABASE_URL before cleanup.");
await neon(connectionString)`alter table accounts drop column if exists initial_password`;
console.log("Removed any historical plaintext password column; password hashes are preserved.");
