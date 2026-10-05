// Exports account metadata only. Passwords and QR tokens are never queried.
import { neon } from "@neondatabase/serverless";
import fs from "node:fs";
import path from "node:path";

const connectionString = (process.env.DATABASE_URL || process.env.POSTGRES_URL)?.trim();
if (!connectionString) throw new Error("Set DATABASE_URL before exporting accounts.");
const sql = neon(connectionString);
const rows = await sql`
  select a.role, a.username, a.display_name, t.team_code, t.seat_no, t.shortlisted
  from accounts a left join teams t on t.account_id = a.id
  order by a.role, a.username
`;
function cell(value) {
  let text = value == null ? "" : String(value);
  if (/^\s*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
const fields = ["role", "username", "display_name", "team_code", "seat_no", "shortlisted"];
const csv = [fields, ...rows.map((r) => fields.map((f) => r[f]))].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
const output = path.resolve("elevate-accounts.csv");
fs.writeFileSync(output, csv, { mode: 0o600 });
fs.chmodSync(output, 0o600);
console.log(`Exported ${rows.length} account records to ${output}. Passwords and QR tokens are excluded.`);
