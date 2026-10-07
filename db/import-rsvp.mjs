// Dry-run by default. Applying requires explicit account mapping and --apply.
import { issuedTeamNumber, teamCode } from "../shared/team-code.js";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { neon } from "@neondatabase/serverless";

const identity = value => String(value || "").normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
const placeholder = value => /^T\d+M[1-4]$/i.test(String(value));

export function buildImportPlan(data, mapping, teams, members, historyIds = []) {
  if (data.version !== 1 || !Array.isArray(data.teams) || !Array.isArray(mapping)) throw new Error("Invalid RSVP input or mapping");
  if (/drive\.google\.com/i.test(JSON.stringify([data, mapping]))) throw new Error("Drive links must not be imported");
  const problems = [], assignments = [], usedAccounts = new Set(), protectedIds = new Set(historyIds);
  const mapByTeam = new Map();
  for (const entry of mapping) {
    if (!entry || typeof entry.sourceTeam !== "string") { problems.push("Mapping entry needs sourceTeam"); continue; }
    const name = identity(entry.sourceTeam);
    if (mapByTeam.has(name)) problems.push(`Duplicate mapping: ${entry.sourceTeam}`);
    mapByTeam.set(name, entry);
  }
  const sourceNames = new Set();
  for (const source of data.teams) {
    const label = source.teamName, sourceKey = identity(label), entry = mapByTeam.get(sourceKey);
    if (sourceNames.has(sourceKey)) { problems.push(`${label}: duplicate RSVP team`); continue; }
    sourceNames.add(sourceKey);
    if (!entry?.username) { problems.push(`${label}: account mapping required`); continue; }
    const team = teams.find(t => identity(t.username) === identity(entry.username) || (issuedTeamNumber(entry.username) && issuedTeamNumber(t.username) === issuedTeamNumber(entry.username)));
    if (!team || usedAccounts.has(entry.username)) { problems.push(`${label}: account missing or assigned twice`); continue; }
    usedAccounts.add(entry.username);
    if (source.issues.some(issue => !issue.startsWith("Declared size"))) { problems.push(`${label}: resolve source validation issues`); continue; }
    if (source.members.length !== source.declaredSize && !entry.memberPositions) {
      problems.push(`${label}: explicit memberPositions required for size mismatch`); continue;
    }
    const positions = entry.memberPositions ?? source.members.map(m => m.position);
    if (!Array.isArray(positions) || positions.length < 2 || positions.length > 4 || new Set(positions).size !== positions.length) {
      problems.push(`${label}: roster must contain 2–4 distinct positions`); continue;
    }
    const roster = members.filter(m => m.team_id === team.id).sort((a,b) => a.sort_order-b.sort_order);
    if (new Set(roster.map(m => m.sort_order)).size !== roster.length) { problems.push(`${label}: current roster has duplicate positions`); continue; }
    const prepared = [];
    let invalid = false;
    for (let index = 0; index < positions.length; index++) {
      const participant = source.members.find(m => m.position === positions[index]);
      if (!participant) { problems.push(`${label}: unknown member position`); invalid = true; continue; }
      const person = { ...participant, ...(entry.memberOverrides?.[String(positions[index])] || {}) };
      if (!person.name?.trim() || !["Veg", "Jain"].includes(person.foodPreference)) {
        problems.push(`${label}: name/food preference required for member ${positions[index]}`); invalid = true; continue;
      }
      const existing = roster.find(m => m.sort_order === index + 1);
      if (existing && identity(existing.name) !== identity(person.name) && (!placeholder(existing.name) || protectedIds.has(existing.id))) {
        problems.push(`${label}: member ${existing.id} has an existing identity/history; manual reconciliation required`); invalid = true;
      }
      prepared.push({ ...person, id: existing?.id || null, sortOrder: index + 1, isLead: index === 0 });
    }
    const removed = roster.filter(m => m.sort_order > positions.length);
    if (removed.some(m => !placeholder(m.name) || protectedIds.has(m.id))) {
      problems.push(`${label}: extra current roster members have identity/history`); invalid = true;
    }
    if (!invalid) assignments.push({ team, source, members: prepared, removeIds: removed.map(m => m.id) });
  }
  for (const sourceKey of mapByTeam.keys()) if (!sourceNames.has(sourceKey)) problems.push(`Mapping has no RSVP response: ${mapByTeam.get(sourceKey).sourceTeam}`);
  return { assignments, problems };
}

async function run() {
  const args = process.argv.slice(2), apply = args.includes("--apply"), paths = args.filter(arg => arg !== "--apply");
  if (paths.length !== 2) throw new Error("Usage: node --env-file=.env db/import-rsvp.mjs normalized.json mapping.json [--apply]");
  const data = JSON.parse(fs.readFileSync(paths[0], "utf8")), mapping = JSON.parse(fs.readFileSync(paths[1], "utf8"));
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("Set DATABASE_URL for the intended database");
  const sql = neon(url);
  const [teams, members, histories] = await Promise.all([
    sql`select t.*, a.username, a.display_name from teams t join accounts a on a.id = t.account_id`,
    sql`select * from team_members`,
    sql`select member_id from meal_logs union select member_id from event_checkins union select member_id from registration_checkins`
  ]);
  const plan = buildImportPlan(data, mapping, teams, members, histories.map(row => row.member_id));
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", mappedTeams: plan.assignments.length,
    participants: plan.assignments.reduce((count,a) => count+a.members.length,0), problems: plan.problems }, null, 2));
  if (plan.problems.length) { process.exitCode = 1; return; }
  if (!apply) return;
  if (plan.assignments.some(a => a.team.username !== teamCode(issuedTeamNumber(a.team.username)) || a.team.team_code !== teamCode(issuedTeamNumber(a.team.username)))) throw new Error("Apply the ELEV team identity migration first");
  const [{ ready }] = await sql`select exists(select 1 from information_schema.columns where table_name='team_members' and column_name='food_preference') and exists(select 1 from information_schema.tables where table_name='team_rsvp_details') as ready`;
  if (!ready) throw new Error("Apply db/participant-details.sql to the approved target before importing");
  const backupDirectory = path.dirname(path.resolve(paths[0]));
  const backupFile = path.join(backupDirectory, `backup-${Date.now()}.json`);
  const affected = new Set(plan.assignments.map(a => a.team.id));
  const rsvp = await sql`select * from team_rsvp_details`;
  fs.writeFileSync(backupFile, JSON.stringify({ teams: teams.filter(t => affected.has(t.id)), members: members.filter(m => affected.has(m.team_id)), rsvp: rsvp.filter(r => affected.has(r.team_id)) }, null, 2), { mode: 0o600 });
  const memberIds = members.filter(m => affected.has(m.team_id)).map(m => m.id);
  const changedIds = plan.assignments.flatMap(a => [...a.removeIds, ...a.members.filter(m => m.id && identity(m.name) !== identity(members.find(old => old.id === m.id).name)).map(m => m.id)]);
  const statements = [sql`select id from team_members where id = any(${memberIds}::int[]) for update`,
    sql`select 1 / case when not exists (
      select 1 from meal_logs where member_id = any(${changedIds}::int[])
      union all select 1 from event_checkins where member_id = any(${changedIds}::int[])
      union all select 1 from registration_checkins where member_id = any(${changedIds}::int[])
    ) then 1 else 0 end as safe_to_import`];
  for (const assignment of plan.assignments) {
    const { team, source } = assignment;
    statements.push(sql`update accounts set display_name = ${source.teamName} where id = ${team.account_id}`);
    for (const m of assignment.members) {
      if (m.id) statements.push(sql`update team_members set name=${m.name}, is_lead=${m.isLead}, sort_order=${m.sortOrder},
        email=${m.email},phone=${m.phone},college=${m.college},year_branch=${m.yearBranch},food_preference=${m.foodPreference} where id=${m.id} and team_id=${team.id}`);
      else statements.push(sql`insert into team_members (team_id,name,is_lead,sort_order,email,phone,college,year_branch,food_preference)
        values (${team.id},${m.name},${m.isLead},${m.sortOrder},${m.email},${m.phone},${m.college},${m.yearBranch},${m.foodPreference})`);
    }
    if (assignment.removeIds.length) statements.push(sql`delete from team_members where team_id=${team.id} and id=any(${assignment.removeIds}::int[])
      and not exists(select 1 from meal_logs where member_id=team_members.id)
      and not exists(select 1 from event_checkins where member_id=team_members.id)
      and not exists(select 1 from registration_checkins where member_id=team_members.id)`);
    statements.push(sql`insert into team_rsvp_details (team_id,source_row,source_hash,responded_at,respondent_email,declared_size,attending,payment_payers,terms_confirmation,declaration)
      values (${team.id},${source.sourceRow},${data.sourceHash},${source.respondedAt},${source.respondentEmail},${source.declaredSize},${source.attending},${JSON.stringify(source.paymentPayers)}::jsonb,${source.termsConfirmation},${source.declaration})
      on conflict(team_id) do update set source_row=excluded.source_row,source_hash=excluded.source_hash,responded_at=excluded.responded_at,
      respondent_email=excluded.respondent_email,declared_size=excluded.declared_size,attending=excluded.attending,payment_payers=excluded.payment_payers,
      terms_confirmation=excluded.terms_confirmation,declaration=excluded.declaration,imported_at=now()`);
  }
  await sql.transaction(statements);
  console.log(`Imported ${plan.assignments.length} teams atomically. Private backup: ${backupFile}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  run().catch(error => { console.error(`Import failed: ${error.message}`); process.exitCode = 1; });
}
