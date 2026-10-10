// Isolated PS concurrency verification. Never loads .env or contacts Neon.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {reserveAiRequest,validateAiBody,encryptKey,decryptKey} from '../api/_lib/ai-gateway.js';
const exec = promisify(execFile);
const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'elevate-ai-pg-'));
const data = path.join(folder, 'data');
const params = ['-h',folder,'-p','55459','-d','postgres','-v','ON_ERROR_STOP=1','-q'];
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

let started=false;
try {
 await exec('initdb',['-D',data,'-A','trust','--no-locale','-E','UTF8']);
 await exec('pg_ctl',['-D',data,'-l',path.join(folder,'postgres.log'),'-o',`-F -k ${folder} -p 55459 -h ''`,'-w','start']);started=true;
 await run('create table teams(id int primary key);insert into teams values(1),(2);');
 const schema=(await fs.readFile('db/ai-gateway.sql','utf8')).replace(/^--.*$/gm,'');
 await run(schema);
 await run("insert into ai_projects values(1,'fixture');insert into ai_team_access values(1,1,'h1','c1',true,2500),(2,1,'h2','c2',true,800000)");
 const batch=await Promise.all(Array.from({length:12},()=>reserveAiRequest(sql,{team_id:1},'fixture',1000)));
 assert.equal(batch.filter(Boolean).length,2,'Concurrent daily quota must admit only 2 requests');
 await run('truncate ai_requests');
 const rate=await Promise.all(Array.from({length:15},()=>reserveAiRequest(sql,{team_id:2},'fixture',1)));
 assert.equal(rate.filter(Boolean).length,10,'Concurrent requests respect team rate limit');
 await run('truncate ai_requests');
 const minute=await Promise.all(Array.from({length:5},()=>reserveAiRequest(sql,{team_id:2},'fixture',20000)));
 assert.equal(minute.filter(Boolean).length,2,'Project minute token reservations cannot overspend');
 await run("truncate ai_requests;update ai_team_access set daily_limit=6000000 where team_id=2;insert into ai_requests(id,team_id,project_id,model,reserved_tokens,charged_tokens,created_at) values('00000000-0000-0000-0000-000000000001',2,1,'fixture',4999500,4999500,clock_timestamp()-interval '2 minutes')");
 assert.equal(await reserveAiRequest(sql,{team_id:2},'fixture',1000),null,'Project daily limit is enforced');
 process.env.SESSION_SECRET='isolated-test-only';assert.equal(decryptKey(encryptKey('fixture-key')),'fixture-key');
 assert.throws(()=>validateAiBody({model:'unknown'}));assert.throws(()=>validateAiBody({model:'gpt-5-mini',messages:[{role:'user',content:'test'}],stream:true}));
 assert.throws(()=>validateAiBody({model:'gpt-5-mini',messages:[{role:'user',content:'test'}],max_completion_tokens:99999}));
 console.log('PASS: concurrent team/day, project/day, team/minute and project/minute limits; input validation; encrypted credential round trip. Isolated local PostgreSQL only.');
} finally {if(started)await exec('pg_ctl',['-D',data,'-m','immediate','stop']);await fs.rm(folder,{recursive:true,force:true});}
