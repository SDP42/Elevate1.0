// One-off, additive provisioning for the new volunteer role — run this
// instead of db/seed.mjs so every existing account's password is left
// untouched. Safe to run more than once: an existing volunteerNN username
// is left alone (not re-hashed), only missing ones are created.
//
//   node db/add-volunteers.mjs

import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
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
const VOLUNTEER_COUNT = 4;

function randomPassword() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(crypto.randomFillSync(new Uint8Array(10)))
    .map((b) => alphabet[b % alphabet.length])
    .join("");
}

async function main() {
  const credentials = [];

  for (let n = 1; n <= VOLUNTEER_COUNT; n += 1) {
    const username = `volunteer${String(n).padStart(2, "0")}`;
    const existing = await sql`select id from accounts where username = ${username}`;
    if (existing[0]) {
      console.log(`${username} already exists — leaving its password alone.`);
      continue;
    }
    const password = randomPassword();
    const passwordHash = await bcrypt.hash(password, 10);
    await sql`
      insert into accounts (username, password_hash, role, display_name)
      values (${username}, ${passwordHash}, 'volunteer', ${`Volunteer ${n}`})
    `;
    credentials.push({ role: "volunteer", username, password, label: `Volunteer ${n}` });
  }

  if (credentials.length === 0) {
    console.log("Nothing to add.");
    return;
  }

  const outFile = path.join(__dirname, "volunteer-credentials.generated.json");
  fs.writeFileSync(outFile, JSON.stringify(credentials, null, 2));

  console.log(`\nAdded ${credentials.length} volunteer account(s).\n`);
  console.log("username".padEnd(14), "password".padEnd(12), "label");
  for (const c of credentials) {
    console.log(c.username.padEnd(14), c.password.padEnd(12), c.label);
  }
  console.log(`\nAlso written to ${outFile} (gitignored).\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
