// Isolated PS concurrency verification. Never loads .env or contacts Neon.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createPsAllocation } from '../api/_lib/ps-allocation.js';
const exec = promisify(execFile);
const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'elevate-ps-pg-'));
const data = path.join(folder, 'data');
const params = ['-h',folder,'-p','55451','-d','postgres','-v','ON_ERROR_STOP=1','-q'];
const literal = v => typeof v === 'number' ? String(v) : `'${String(v).replaceAll("'", "''")}'`;
function csv(text) {
  const rows=[];let row=[],field="",quoted=false;
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(c==='"') { if(quoted && text[i+1]==='"'){field+='"';i++;} else quoted=!quoted; }
    else if(!quoted && c===','){row.push(field);field="";}
    else if(!quoted && c==='\n'){row.push(field);rows.push(row);row=[];field="";}
    else field+=c;
  }
  if(field||row.length){row.push(field);rows.push(row);}
  const headers=rows.shift()||[];
  return rows.filter(r=>r.length===headers.length).map(values=>Object.fromEntries(headers.map((key,i)=> {
    const v=values[i]; return [key, v==="" ? null : v==="t" ? true : v==="f" ? false : /^\d+$/.test(v) ? Number(v) : /^[[{]/.test(v) ? JSON.parse(v) : v];
  })));
}
function sql(strings,...values) { return strings.reduce((q,s,i)=>q+s+(i<values.length?literal(values[i]):''),''); }
sql.transaction = async queries => {
  if (typeof queries === "function") queries = queries(sql);
  const source = 'begin isolation level read committed;\n' + queries.map((q,i)=>`\\echo RESULT${i}\n${q};`).join('\n') + '\ncommit;';
  const file = path.join(folder, `query-${Math.random()}.sql`);
  await fs.writeFile(file, source);
  const {stdout} = await exec('psql',[...params,'--csv','-f',file]);
  await fs.unlink(file);
  return queries.map((_,i)=>{
    const part = stdout.split(`RESULT${i}\n`)[1]?.split('RESULT')[0] || '';
    return csv(part);
  });
};
const run = async q => exec('psql',[...params,'-c',q]);
const allocation = createPsAllocation(sql);
let started=false;
try {
  await exec('initdb',['-D',data,'-A','trust','--no-locale','-E','UTF8']);
  await exec('pg_ctl',['-D',data,'-l',path.join(folder,'postgres.log'),'-o',`-F -k ${folder} -c listen_addresses='' -p 55451`,'-w','start']); started=true;
  await run(`create table teams(id int primary key, withdrawn bool default false);
    create table ps_list(id int primary key, revealed bool default true, capacity int);
    create table team_ps_selection(team_id int primary key references teams, ps_id int references ps_list,
      status text, requested_at timestamptz, approved_at timestamptz, approved_by int);
    insert into teams select generate_series(1,32);
    insert into ps_list values(1,true,2),(2,true,32),(3,false,3),(4,true,0);`);
  const selections = await Promise.all(Array.from({length:32},(_,i)=>allocation.request(i+1,1)));
  assert.equal(selections.filter(Boolean).length,32);
  const order = await exec('psql',[...params,'-At','-c','select team_id from team_ps_selection order by requested_at,team_id']);
  const ids=order.stdout.trim().split('\n').map(Number);
  assert.equal((await allocation.approve(ids[31],101)).selection.status,'pending');
  await Promise.all(Array.from({length:10},()=>allocation.approve(ids[0],101)));
  assert.equal((await allocation.approve(ids[1],102)).selection.status,'approved');
  const approvals=await Promise.all(ids.slice(2).map(id=>allocation.approve(id,101)));
  assert.ok(approvals.every(r=>r.selection.status==='pending'));
  const count=await exec('psql',[...params,'-At','-c',"select count(*) from team_ps_selection where status='approved'"]);
  assert.equal(Number(count.stdout),2);
  assert.equal(await allocation.request(ids[0],2),null);
  await allocation.revoke(ids[0]);
  assert.equal((await allocation.approve(ids[2],102)).selection.status,'approved');
  assert.equal(await allocation.request(ids[3],3),null);
  assert.equal((await allocation.request(ids[3],4)).status,'pending');
  assert.equal((await allocation.approve(ids[3],102)).selection.status,'pending');
  await run('truncate team_ps_selection');
  await allocation.request(1,1);
  await Promise.all([allocation.approve(1,101),allocation.request(1,2)]);
  const state=await exec('psql',[...params,'-At','-c','select ps_id,status from team_ps_selection where team_id=1']);
  assert.ok(['1|approved','2|approved','2|pending'].includes(state.stdout.trim()));
  if(state.stdout.includes('approved')) assert.equal(await allocation.request(1,1),null);
  await run("truncate team_ps_selection; update teams set withdrawn=true where id=32");
  assert.equal(await allocation.request(32,1),null);
  await allocation.request(1,2);
  const before=await exec('psql',[...params,'-At','-c','select requested_at from team_ps_selection where team_id=1']);
  await allocation.request(1,2);
  const after=await exec('psql',[...params,'-At','-c','select requested_at from team_ps_selection where team_id=1']);
  assert.equal(before.stdout,after.stdout);
  await run(`truncate team_ps_selection;update teams set withdrawn=false;
    update ps_list set revealed=true,capacity=case id when 1 then 2 when 2 then 3 when 3 then 5 else 100 end;
    create table team_ps_preferences(team_id int primary key references teams,preference1 int references ps_list,preference2 int references ps_list,preference3 int references ps_list,preference4 int references ps_list,submitted_at timestamptz default clock_timestamp());`);
  const ranked=await Promise.all(Array.from({length:32},(_,i)=>allocation.allocatePreferences(i+1,[1,2,3,4])));
  assert.equal(ranked.filter(r=>r.saved).length,32);assert.equal(ranked.filter(r=>r.allocated).length,10);
  const counts=await exec('psql',[...params,'-At','-c',"select ps_id,count(*) from team_ps_selection where status='approved' group by ps_id order by ps_id"]);
  assert.equal(counts.stdout.trim(),'1|2\n2|3\n3|5');
  const winner=ranked.findIndex(r=>r.allocated)+1,oldPs=ranked[winner-1].selection.ps_id;
  const duplicate=await allocation.allocatePreferences(winner,[4,3,2,1]);assert.equal(duplicate.saved,false);assert.equal(duplicate.selection.ps_id,oldPs);
  await run('update ps_list set revealed=false where id=4');
  const unavailable=ranked.findIndex(r=>!r.allocated)+1;
  assert.equal((await allocation.allocatePreferences(unavailable,[4,3,2,1])).allocated,false);
  await run(`truncate team_ps_selection;update ps_list set revealed=true;update ps_list set capacity=0 where id<4`);
  assert.equal((await allocation.allocatePreferences(1,[1,2,3,4])).saved,true);
  assert.equal((await allocation.allocatePreferences(1,[1,2,3,4])).selection,null);
  process.env.DATABASE_URL='postgresql://fixture:fixture@localhost/elevate_fixture';
  process.env.SESSION_SECRET=(await import('node:crypto')).randomBytes(48).toString('hex');
  const {createPsHandler}=await import('../api/ps.js');const handler=createPsHandler({sql});
  for(const preferences of [[1,1,2,3],[1,2,3],[1,2,3,'4'],null]){
    const res={status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
    await handler({method:'POST',session:{role:'team',teamId:1},body:{preferences}},res);assert.equal(res.code,400);
  }
  await run('truncate team_ps_selection;update ps_list set revealed=true,capacity=8');
  const balanced=await Promise.all(Array.from({length:32},(_,i)=>allocation.allocatePreferences(i+1,Array.from({length:4},(_,j)=>(i+j)%4+1))));
  assert.equal(balanced.filter(r=>r.allocated).length,32);
  const balancedCounts=await exec('psql',[...params,'-At','-c',"select ps_id,count(*) from team_ps_selection group by ps_id order by ps_id"]);
  assert.equal(balancedCounts.stdout.trim(),'1|8\n2|8\n3|8\n4|8');
  console.log('PASS: ranked preferences under 32 concurrent submissions; first/second/third fallback caps 2/3/5, fourth recorded but never allocated, duplicate submissions keep locked allocation, hidden/zero capacity.');
  console.log('PASS: 32 simultaneous requests, parallel approvals/capacity, FIFO, approval/request race, revocation, hidden/withdrawn/zero capacity, idempotent queue.');
} finally {
  if(started) await exec('pg_ctl',['-D',data,'-m','immediate','stop']);
  await fs.rm(folder,{recursive:true,force:true});
}
