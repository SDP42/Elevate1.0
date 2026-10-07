// Dry-run first; rename issued team identities without changing passwords/QRs.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { neon } from "@neondatabase/serverless";
import { issuedTeamNumber, teamCode } from "../shared/team-code.js";

export function identityPlan(teams, accounts) {
  const changes = [], problems = [], used = new Set();
  for (const team of teams) {
    const number = issuedTeamNumber(team.username);
    if (!number) { problems.push(`Account ${team.username}: issued number needs a mapping`); continue; }
    const code = teamCode(number);
    if (used.has(code) || teams.some(other => other.id !== team.id && other.team_code.toUpperCase() === code) || accounts.some(other => other.id !== team.account_id && other.username.toUpperCase() === code)) {
      problems.push(`${code}: identity collision`); continue;
    }
    used.add(code);
    changes.push({ id:team.id, accountId:team.account_id, oldUsername:team.username, oldCode:team.team_code, username:code.toLowerCase(), loginLabel:code, code });
  }
  return { changes, problems };
}
async function run() {
  const args=process.argv.slice(2);
  if(args.some(arg=>arg!=="--apply")) throw new Error("Usage: node --env-file=.env db/team-identities.mjs [--apply]");
  const sql=neon(process.env.DATABASE_URL||process.env.POSTGRES_URL);
  const [teams,accounts]=await Promise.all([sql`select t.id,t.account_id,t.team_code,a.username from teams t join accounts a on a.id=t.account_id`,sql`select id,username from accounts`]);
  const plan=identityPlan(teams,accounts);
  console.log(JSON.stringify({mode:args.includes("--apply")?"apply":"dry-run",...plan},null,2));
  if(plan.problems.length){process.exitCode=1;return;}
  if(!args.includes("--apply"))return;
  const directory=path.resolve('.local-rsvp');fs.mkdirSync(directory,{recursive:true,mode:0o700});
  fs.writeFileSync(path.join(directory,`identity-backup-${Date.now()}.json`),JSON.stringify(plan.changes,null,2),{mode:0o600});
  const writes=[sql`select id from teams where id=any(${plan.changes.map(c=>c.id)}::int[]) for update`,sql`select id from accounts where id=any(${plan.changes.map(c=>c.accountId)}::int[]) for update`];
  for(const c of plan.changes){writes.push(sql`update accounts set username=${c.username} where id=${c.accountId}`);writes.push(sql`update teams set team_code=${c.code} where id=${c.id}`);}
  await sql.transaction(writes);
  console.log(`Updated ${plan.changes.length} issued team identities. Passwords, seats and QR tokens preserved.`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)run().catch(error=>{console.error(`Identity update failed: ${error.message}`);process.exitCode=1;});
