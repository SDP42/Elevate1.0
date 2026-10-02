// Seeds demo accounts for Phase 1: 35 team accounts (30 will be shortlisted;
// 5 spare in case a shortlisted team's slot needs reassigning), 5 core
// accounts, 2 admin accounts, 3 meal accounts. Run once against a fresh
// database — see db/SETUP.md for how to point this at your Neon/Vercel
// Postgres instance.
//
//   node db/seed.mjs
//
// Prints every generated username/password once, and also writes them to
// db/credentials.generated.json (gitignored) — that file is the only place
// the plaintext passwords exist; the database only ever stores a hash.

import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const connectionString = (process.env.DATABASE_URL || process.env.POSTGRES_URL)?.trim();

if (!connectionString) {
  console.error("Set DATABASE_URL (or POSTGRES_URL) before running this script — see db/SETUP.md.");
  process.exit(1);
}

const rawSql = neon(connectionString);

async function execWithRetry(fn) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === 4) throw err;
      await new Promise((r) => setTimeout(r, 250 * attempt));
    }
  }
}

const sql = new Proxy(rawSql, {
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

const TEAM_COUNT = 35;
const MEMBERS_PER_TEAM = 4; // placeholder roster size; real teams range 2-4 per the site's FAQ
const CORE_COUNT = 5;
const ADMIN_COUNT = 2;
const MEAL_COUNT = 3;
const REGIDESK_COUNT = 3;

function randomPassword() {
  // 10 chars, unambiguous alphabet (no 0/O/1/l/I) — easy to read off a sheet
  // and hand to a team at check-in without transcription errors.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(crypto.randomFillSync(new Uint8Array(10)))
    .map((b) => alphabet[b % alphabet.length])
    .join("");
}

async function upsertAccount({ username, password, role, displayName }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const rows = await sql`
    insert into accounts (username, password_hash, role, display_name, initial_password)
    values (${username}, ${passwordHash}, ${role}, ${displayName}, ${password})
    on conflict (username) do update set
      password_hash = excluded.password_hash,
      display_name = excluded.display_name,
      initial_password = excluded.initial_password
    returning id
  `;
  return rows[0].id;
}

async function main() {
  const credentials = [];

  // Clean slate before seeding
  await sql`truncate table audit_log, registration_checkins, meal_logs, round1_notes, marks, incidents, core_assignments, core_recusals, team_ps_selection, team_members, teams, accounts restart identity cascade`;

  for (let n = 1; n <= TEAM_COUNT; n += 1) {
    const randDigits = Math.floor(10 + Math.random() * 90);
    const username = `team${n}_${randDigits}`;
    const password = randomPassword();
    const displayName = `Team ${n}`;

    const accountId = await upsertAccount({ username, password, role: "team", displayName });

    const qrToken = crypto.randomBytes(16).toString("hex");
    const teamRows = await sql`
      insert into teams (account_id, team_code, seat_no, qr_token, shortlisted)
      values (${accountId}, ${`T${n}`}, ${n}, ${qrToken}, false)
      on conflict (account_id) do update set
        team_code = excluded.team_code,
        qr_token = coalesce(teams.qr_token, ${qrToken}),
        shortlisted = false
      returning id
    `;
    const teamId = teamRows[0].id;

    await sql`delete from team_members where team_id = ${teamId}`;
    for (let m = 1; m <= MEMBERS_PER_TEAM; m += 1) {
      await sql`
        insert into team_members (team_id, name, is_lead, sort_order)
        values (${teamId}, ${`T${n}M${m}`}, ${m === 1}, ${m})
      `;
    }

    credentials.push({ role: "team", username, password, label: `Team ${n}` });
  }

  // --- staff ---------------------------------------------------------------
  for (let n = 1; n <= CORE_COUNT; n += 1) {
    const username = `core${String(n).padStart(2, "0")}`;
    const password = randomPassword();
    await upsertAccount({ username, password, role: "core", displayName: `Core ${n}` });
    credentials.push({ role: "core", username, password, label: `Core ${n}` });
  }

  for (let n = 1; n <= ADMIN_COUNT; n += 1) {
    const username = `admin${String(n).padStart(2, "0")}`;
    const password = randomPassword();
    await upsertAccount({ username, password, role: "admin", displayName: `Admin ${n}` });
    credentials.push({ role: "admin", username, password, label: `Admin ${n}` });
  }

  for (let n = 1; n <= MEAL_COUNT; n += 1) {
    const username = `meal${String(n).padStart(2, "0")}`;
    const password = randomPassword();
    await upsertAccount({ username, password, role: "meal", displayName: `Meal Counter ${n}` });
    credentials.push({ role: "meal", username, password, label: `Meal Counter ${n}` });
  }

  for (let n = 1; n <= REGIDESK_COUNT; n += 1) {
    const username = `regidesk${String(n).padStart(2, "0")}`;
    const password = randomPassword();
    await upsertAccount({ username, password, role: "regidesk", displayName: `Registration Desk ${n}` });
    credentials.push({ role: "regidesk", username, password, label: `Registration Desk ${n}` });
  }

  const outFile = path.join(__dirname, "credentials.generated.json");
  fs.writeFileSync(outFile, JSON.stringify(credentials, null, 2));

  console.log(`\nSeeded ${credentials.length} accounts.\n`);
  console.log("username".padEnd(12), "password".padEnd(12), "role".padEnd(8), "label");
  for (const c of credentials) {
    console.log(c.username.padEnd(12), c.password.padEnd(12), c.role.padEnd(8), c.label);
  }
  console.log(`\nFull list also written to ${outFile} (gitignored — keep it safe, not in the repo).\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
