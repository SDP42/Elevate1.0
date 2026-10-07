// Adds missing demo accounts. Existing passwords, teams, rosters and event
// history are preserved. Optional: --credentials-file /private/accounts.json
import { neon } from "@neondatabase/serverless";
import { teamCode, issuedTeamNumber } from "../shared/team-code.js";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const connectionString = (process.env.DATABASE_URL || process.env.POSTGRES_URL)?.trim();
if (!connectionString) throw new Error("Set DATABASE_URL before seeding.");
const sql = neon(connectionString);
const counts = { team: 32, core: 5, admin: 2, meal: 3, regidesk: 3 };
const labels = { team: "Team", core: "Core", admin: "Admin", meal: "Meal Counter", regidesk: "Registration Desk" };
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--credentials-file")) {
  throw new Error("Usage: npm run db:seed -- [--credentials-file /private/accounts.json]");
}
const supplied = args.length ? JSON.parse(fs.readFileSync(path.resolve(args[1]), "utf8")) : null;
const rawCandidates = supplied || Object.entries(counts).flatMap(([role, count]) =>
  Array.from({ length: count }, (_, i) => ({
    role, username: role === "team" ? teamCode(i + 1).toLowerCase() : `${role}${String(i + 1).padStart(2, "0")}`,
    password: crypto.randomBytes(12).toString("base64url"), label: `${labels[role]} ${i + 1}`,
  }))
);
if (!Array.isArray(rawCandidates) || !rawCandidates.length) throw new Error("A nonempty account array is required.");
const candidates = rawCandidates.map(account => account.role === "team" && issuedTeamNumber(account.username)
  ? { ...account, username: teamCode(issuedTeamNumber(account.username)).toLowerCase() } : account);
const usernames = new Set();
for (const account of candidates) {
  if (!Object.hasOwn(counts, account.role) || typeof account.username !== "string" ||
      !/^[a-zA-Z0-9_]{1,80}$/.test(account.username) || typeof account.password !== "string" ||
      account.password.length < 8 || typeof account.label !== "string" || !account.label.trim() ||
      usernames.has(account.username)) throw new Error("Invalid or duplicate account in seed input.");
  if (account.role === "team" && !/^(?:team|ELEV)\d{2,4}$/i.test(account.username)) {
    throw new Error("Team seed usernames must use ELEV01, ELEV02, etc. Legacy team01 inputs are normalized to ELEV01.");
  }
  usernames.add(account.username);
}
const existing = new Set((await sql`select username from accounts`).flatMap((a) => [a.username.toLowerCase(), ...(issuedTeamNumber(a.username) ? [teamCode(issuedTeamNumber(a.username)).toLowerCase(), `team${String(issuedTeamNumber(a.username)).padStart(2, "0")}`] : [])]));
const missing = candidates.filter((a) => !existing.has(a.username.toLowerCase()));
if (missing.length) {
  const output = path.join(directory, "credentials.generated.json");
  const previous = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, "utf8")) : [];
  const archive = [...previous.filter((a) => !missing.some((b) => a.username === b.username)), ...missing];
  // Save passwords before issuing writes so failed runs can be recovered locally.
  fs.writeFileSync(output, JSON.stringify(archive, null, 2) + "\n", { mode: 0o600 });
  fs.chmodSync(output, 0o600);
}
let created = 0;
for (const account of missing) {
  const hash = await bcrypt.hash(account.password, 10);
  const statements = [sql`
    insert into accounts (username, password_hash, role, display_name)
    values (${account.username}, ${hash}, ${account.role}, ${account.label})
  `];
  if (account.role === "team") {
    const number = issuedTeamNumber(account.username);
    statements.push(sql`
      insert into teams (account_id, team_code, seat_no, qr_token)
      select id, ${teamCode(number)}, ${number}, ${crypto.randomBytes(16).toString("hex")}
      from accounts where username = ${account.username}
    `);
    for (let member = 1; member <= 4; member += 1) {
      statements.push(sql`
        insert into team_members (team_id, name, is_lead, sort_order)
        select t.id, ${`T${number}M${member}`}, ${member === 1}, ${member}
        from teams t join accounts a on a.id = t.account_id
        where a.username = ${account.username}
      `);
    }
  }
  // Account, team and placeholder roster are created atomically. Conflicts
  // roll back this account, without overwriting an existing identity or roster.
  await sql.transaction(statements);
  created += 1;
}
console.log(`Created ${created} missing accounts; preserved ${candidates.length - missing.length} existing accounts. New credentials, when present, are in db/credentials.generated.json.`);
