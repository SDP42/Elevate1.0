// Explicit destructive finalist replacement. Dry-run by default; private full
// backup and a locked snapshot guard precede every --apply transaction.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { teamCode } from '../shared/team-code.js';

export function validateFinalists(data, teams) {
  if (data.version !== 1 || data.teams?.length !== 32 || !data.sourceHash) throw new Error('Expected 32 validated finalists');
  if (/drive\.google\.com/i.test(JSON.stringify(data))) throw new Error('Drive links are prohibited');
  const names = new Set(), emails = new Set(), ids = new Set();
  return data.teams.map((source, index) => {
    const code = teamCode(index+1), team = teams.find(t => t.team_code === code && t.username.toLowerCase() === code.toLowerCase());
    if (!team || ids.has(team.id)) throw new Error(`Missing or duplicate issued account: ${code}`);
    ids.add(team.id);
    const name = source.teamName?.trim().toLowerCase();
    if (!name || names.has(name) || source.issues?.length || source.members?.length !== source.declaredSize || source.declaredSize < 2 || source.declaredSize > 4) throw new Error(`Invalid roster: ${code}`);
    names.add(name);
    source.members.forEach((m,i) => {
      if (m.position !== i+1 || !m.name?.trim() || m.name.trim() === '-' || m.isLead !== (i===0) || !['Veg','Jain'].includes(m.foodPreference) ||
          (m.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email) || emails.has(m.email.toLowerCase()))) || !/^\+91\d{10}$/.test(m.phone || '')) throw new Error(`Invalid participant: ${code}/${i+1}`);
      if (m.email) emails.add(m.email.toLowerCase());
    });
    return {source,team,seat:index+1};
  });
}

const identifier = name => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error('Unsafe table identifier');
  return `"${name}"`;
};

export function resetStatements(sql, data, assignments, teamTables) {
  const statements = [];
  // These operational records belong to the replaced roster, not the finalists.
  for (const name of teamTables.filter(n => !['teams','team_members'].includes(n))) statements.push(sql.query(`delete from ${identifier(name)} where team_id in (select id from teams)`));
  statements.push(sql`delete from team_members`);
  const accountIds = assignments.map(a => a.team.account_id);
  statements.push(sql`delete from accounts where role='team' and not (id=any(${accountIds}::int[]))`);
  for (const {source,team,seat} of assignments) {
    statements.push(sql`update accounts set display_name=${source.teamName} where id=${team.account_id} and role='team'`);
    statements.push(sql`update teams set seat_no=${seat},shortlisted=true,withdrawn=false,
      dietary=null,submission_url=null,submission_note=null,submitted_at=null,
      qr_token=coalesce(qr_token,${crypto.randomBytes(16).toString('hex')}) where id=${team.id}`);
    for (const m of source.members) statements.push(sql`insert into team_members
      (team_id,name,is_lead,sort_order,email,phone,college,year_branch,food_preference)
      values (${team.id},${m.name},${m.isLead},${m.position},${m.email},${m.phone},${m.college},${m.yearBranch},${m.foodPreference})`);
    statements.push(sql`insert into team_rsvp_details
      (team_id,source_row,source_hash,responded_at,respondent_email,declared_size,attending,payment_payers,terms_confirmation,declaration)
      values (${team.id},${source.sourceRow},${data.sourceHash},${source.respondedAt},${source.respondentEmail},${source.declaredSize},true,
      ${JSON.stringify(source.paymentPayers)}::jsonb,${source.termsConfirmation},${source.declaration})`);
  }
  statements.push(sql`select 1 / case when (select count(*) from teams)=32 and
    (select count(*) from accounts where role='team')=32 and
    (select count(*) from team_members)=${assignments.reduce((n,a)=>n+a.source.members.length,0)} and
    (select count(*) from team_members where is_lead)=32 then 1 else 0 end as roster_valid`);
  return statements;
}

async function run() {
  const args=process.argv.slice(2), apply=args.includes('--apply'), inputs=args.filter(a=>a!=='--apply');
  if (inputs.length!==1) throw new Error('Usage: node --env-file=.env db/replace-finalists.mjs private-finalists.json [--apply]');
  const data=JSON.parse(fs.readFileSync(inputs[0],'utf8'));
  const sql=neon(process.env.DATABASE_URL || process.env.POSTGRES_URL);
  const teams=await sql`select t.*,a.username from teams t join accounts a on a.id=t.account_id`;
  const assignments=validateFinalists(data,teams);
  const tables=await sql`select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name`;
  const teamTables=(await sql`select table_name from information_schema.columns where table_schema='public' and column_name='team_id' order by table_name`).map(t=>t.table_name);
  const snapshot={};
  for (const {table_name:name} of tables) {
    const [row]=await sql.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) as rows from ${identifier(name)} t`);
    snapshot[name]=row.rows;
  }
  console.log(JSON.stringify({mode:apply?'apply':'dry-run',teams:32,participants:assignments.reduce((n,a)=>n+a.source.members.length,0),
    foodPreferences:data.teams.flatMap(t=>t.members).reduce((counts,m)=>(counts[m.foodPreference]=(counts[m.foodPreference]||0)+1,counts),{}),
    removedAccounts:teams.filter(t=>!assignments.some(a=>a.team.id===t.id)).map(t=>t.team_code),
    resetRecords:Object.fromEntries(teamTables.filter(t=>t!=='team_members').map(t=>[t,snapshot[t]?.length||0]))},null,2));
  if (!apply) return;
  const backup=path.join(path.dirname(path.resolve(inputs[0])),`before-finalists-${Date.now()}.json`);
  fs.writeFileSync(backup,JSON.stringify(snapshot,null,2)+'\n',{mode:0o600});fs.chmodSync(backup,0o600);
  // Reject drift after the backup, so an in-flight staff write cannot be lost.
  const statements=[sql.query(`lock table ${tables.map(t=>identifier(t.table_name)).join(',')} in share row exclusive mode`)];
  for (const {table_name:name} of tables) statements.push(sql.query(`select 1 / case when
    (select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from ${identifier(name)} t)=$1::jsonb then 1 else 0 end as snapshot_unchanged`,[JSON.stringify(snapshot[name])]));
  statements.push(...resetStatements(sql,data,assignments,teamTables));
  await sql.transaction(statements);
  const passwordsBefore=new Map(snapshot.accounts.filter(a=>accountIds(assignments).includes(a.id)).map(a=>[a.id,a.password_hash]));
  const after=await sql`select id,password_hash from accounts where role='team'`;
  if (after.some(a=>passwordsBefore.get(a.id)!==a.password_hash)) throw new Error('Post-import password invariant failed');
  console.log(`Applied 32 finalists atomically; passwords preserved. Private backup: ${backup}`);
}
const accountIds = assignments => assignments.map(a=>a.team.account_id);
if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) run().catch(error=>{
  console.error(`Finalist replacement failed: ${error.message}`);process.exitCode=1;
});
