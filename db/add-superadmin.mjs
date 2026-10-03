// Creates (or re-keys) the single super admin login. The password is read
// from SUPERADMIN_PASSWORD, never stored in the repo:
//
//   SUPERADMIN_PASSWORD='...' node db/add-superadmin.mjs
//
// Safe to re-run — it only ever touches the `superadmin` account. Writes
// db/superadmin-credentials.csv (gitignored) so the login can be handed
// over; the database itself only ever holds the bcrypt hash.

import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const password = process.env.SUPERADMIN_PASSWORD;
const USERNAME = "superadmin";

if (!connectionString) {
  console.error("Set DATABASE_URL (or POSTGRES_URL) — see db/SETUP.md.");
  process.exit(1);
}
if (!password) {
  console.error("Set SUPERADMIN_PASSWORD.");
  process.exit(1);
}

const sql = neon(connectionString);
const hash = await bcrypt.hash(password, 10);

await sql`
  insert into accounts (username, password_hash, role, display_name)
  values (${USERNAME}, ${hash}, 'superadmin', 'Super Admin')
  on conflict (username) do update set password_hash = excluded.password_hash, role = 'superadmin'
`;
await sql`delete from login_attempts where username = ${USERNAME}`;

fs.writeFileSync(
  path.join(__dirname, "superadmin-credentials.csv"),
  `role,username,password,label\nsuperadmin,${USERNAME},${password},Super Admin\n`
);
console.log(`Super admin ready: username "${USERNAME}". Credentials written to db/superadmin-credentials.csv (gitignored).`);
