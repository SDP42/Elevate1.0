// Disposable local PostgreSQL integration verification. Never loads .env.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { validateFinalists, resetStatements } from '../db/replace-finalists.mjs';
const exec = promisify(execFile);
process.env.DATABASE_URL = "postgresql://fixture:fixture@localhost/elevate_fixture";
process.env.SESSION_SECRET = crypto.randomBytes(48).toString("hex");
const { createAdminHandler } = await import("../api/admin.js");
const { createAuthHandler } = await import("../api/auth.js");
const { signSession } = await import("../api/_lib/auth.js");
const { createCoreHandler } = await import("../api/core.js");
const { createMealHandler } = await import("../api/meal.js");
const { createRegistrationHandler } = await import("../api/regidesk.js");
const folder = await fs.mkdtemp(path.join(os.tmpdir(), "elevate-meals-pg-"));
const data = path.join(folder,"data"), port = "55449";
const params = ["-h",folder,"-p",port,"-d","postgres","-v","ON_ERROR_STOP=1","-q"];
const literal = value => value == null ? "null" : Array.isArray(value) ? `'${JSON.stringify(value).replaceAll("[","{").replaceAll("]","}")}'` : typeof value === "boolean" ? String(value) : typeof value === "number" ? String(value) : `'${String(value).replaceAll("'","''")}'`;
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
async function sql(strings,...values) {
  const query=strings.reduce((text,piece,index)=>text+piece+(index<values.length?literal(values[index]):""),"");
  const result=await exec("psql",[...params,"--csv","-c",query]);return csv(result.stdout);
}
const admin=createAdminHandler({sql,logAction:async()=>{}});
const auth=createAuthHandler({sql,logAction:async()=>{}});
const core=createCoreHandler({sql,logAction:async()=>{}});
const meal=createMealHandler({sql,logAction:async()=>{},createIncident:async()=>{}});
const registration=createRegistrationHandler({sql,logAction:async()=>{},createIncident:async()=>{}});
async function call(handler,body,{role="meal",accountId=3,teamId,url="/api/meal",method="POST"}={}) {
  const res={setHeader(){},code:200,status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
  await handler({body,method,url,session:{role,accountId,teamId}},res);return res;
}
let started=false;
try {
  await exec("initdb",["-D",data,"-A","trust","--no-locale","-E","UTF8"]);
  await exec("pg_ctl",["-D",data,"-l",path.join(folder,"postgres.log"),"-o",`-F -k ${folder} -c listen_addresses='' -p ${port}`,"-w","start"]);started=true;
  await exec("psql",[...params,"-f",path.resolve("db/schema.sql")]);
  await exec("psql",[...params,"-f",path.resolve("db/participant-details.sql")]);
  await sql`insert into accounts (id,username,password_hash,role,display_name) values
    (1,'fixture_team_a','unused','team','Fixture Four'),(2,'fixture_team_b','unused','team','Fixture Two'),
    (3,'fixture_meal_a','unused','meal','Counter A'),(4,'fixture_meal_b','unused','meal','Counter B'),
    (5,'fixture_registration','unused','regidesk','Desk A'),(6,'fixture_team_c','unused','team','Fixture Three')`;
  await sql`insert into teams (id,account_id,team_code,seat_no,qr_token,shortlisted) values
    (1,1,'T1',1,${'a'.repeat(32)},true),(2,2,'T2',2,${'b'.repeat(32)},true),(3,6,'T3',3,${'c'.repeat(32)},true)`;
  await sql`insert into team_members (id,team_id,name,is_lead,sort_order,food_preference) values
    (1,1,'Ada',true,1,'Veg'),(2,1,'Bea',false,2,'Jain'),(3,1,'Chen',false,3,'Veg'),(4,1,'Dev',false,4,'Veg'),
    (5,2,'Eli',true,1,'Veg'),(6,2,'Flo',false,2,'Veg'),(7,3,'Gio',true,1,'Veg'),(8,3,'Hari',false,2,'Veg'),(9,3,'Ira',false,3,'Veg')`;
  await sql`insert into submission_files(team_id,kind,name,mime_type,size,content) values
    (1,'pdf','first.pdf','application/pdf',5,decode('JVBERi0=','base64')),
    (1,'pdf','second.pdf','application/pdf',5,decode('JVBERi0=','base64'))`;
  assert.equal((await sql`select count(*)::int as n from submission_files where team_id=1 and kind='pdf'`)[0].n,2);
  await sql`insert into accounts(id,username,password_hash,role,display_name) values (7,'fixture_admin','unused','admin','Fixture Admin')`;
  const allTeams = await call(core,null,{role:'admin',accountId:7,method:'GET'});
  assert.equal(allTeams.body.teams.length,3); // No registrations yet; admin still sees everyone.
  assert.equal((await call(core,null,{role:'core',accountId:7,method:'GET'})).body.teams.length,0);
  const mark = await call(core,{teamId:1,score:86,mentoring1Feedback:'First mentoring',mentoring2Feedback:'Second mentoring'},{role:'admin',accountId:7});
  assert.equal(mark.body.score,86);
  const savedMark=(await sql`select score::int as score,criteria,mentoring1_feedback,feedback,feedback_approved from marks where team_id=1`)[0];
  assert.deepEqual(savedMark,{score:86,criteria:null,mentoring1_feedback:'First mentoring',feedback:'Second mentoring',feedback_approved:false});
  for(const score of [-1,101,Infinity,null,'90']) assert.equal((await call(core,{teamId:1,score},{role:'admin',accountId:7})).code,400);
  assert.equal((await call(core,{teamId:1,score:100,mentoring1Feedback:{}},{role:'admin',accountId:7})).code,400);
  assert.equal((await call(core,{teamId:1,score:100,mentoring2Feedback:'x'.repeat(10001)},{role:'admin',accountId:7})).code,400);
  await sql`update marks set feedback_approved=true where team_id=1`;
  assert.equal((await call(core,{teamId:1,score:85,mentoring1Feedback:'Revised 1',mentoring2Feedback:'Revised 2'},{role:'admin',accountId:7})).body.score,85);
  assert.equal((await sql`select feedback_approved from marks where team_id=1`)[0].feedback_approved,false);
  const audienceCall=body=>call(admin,body,{role:'admin',accountId:7,url:'/api/admin'});
  assert.equal((await audienceCall({action:'save-announcement',message:'For all',active:true})).code,200);
  assert.equal((await audienceCall({action:'save-announcement',message:'Only A',teamId:1,active:true})).code,200);
  assert.equal((await audienceCall({action:'save-announcement',message:'Invalid target',teamId:999})).code,400);
  async function sessionRead(teamId,accountId){
    const token=signSession({role:'team',teamId,accountId,displayName:'Fixture'});
    const res={setHeader(){},code:200,status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
    await auth({method:'GET',url:'/api/auth',headers:{cookie:`elevate_session=${token}`}},res);return res;
  }
  assert.equal((await sessionRead(1,1)).body.team.mentoring1Feedback,null);
  const release=await audienceCall({action:'approve-feedback',all:true,approved:true});assert.equal(release.code,200);
  const a=await sessionRead(1,1),otherTeam=await sessionRead(2,2);
  assert.equal(a.body.team.mentoring1Feedback,'Revised 1');assert.equal(a.body.team.mentoring2Feedback,'Revised 2');assert.equal(a.body.team.score,85);
  assert.deepEqual(a.body.announcements.map(a=>a.message),['For all','Only A']);
  assert.deepEqual(otherTeam.body.announcements.map(a=>a.message),['For all']);
  const targeted=(await call(admin,null,{role:'admin',accountId:7,url:'/api/admin?resource=announcements',method:'GET'})).body.announcements.find(a=>a.teamId===1);
  const {teamId:targetTeamId,...withoutAudience}=targeted;assert.equal(targetTeamId,1);
  await audienceCall({action:'save-announcement',...withoutAudience,pinned:true});
  assert.equal((await sql`select team_id from announcements where id=${targeted.id}`)[0].team_id,1);
  await audienceCall({action:'approve-feedback',all:true,approved:false});assert.equal((await sessionRead(1,1)).body.team.mentoring2Feedback,null);
  assert.equal((await call(meal,{qrPayload:'ELEVATE1:'+ 'a'.repeat(32),mealSlotCode:'d1_breakfast'})).code,403);
  for(const [teamId,token,ids] of [[1,'a',[1,2,3,4]],[2,'b',[5,6]],[3,'c',[7,8,9]]]) {
    for(let index=0;index<ids.length;index++) {
      const lookup=await call(registration,{qrPayload:'ELEVATE1:'+token.repeat(32)},{role:'regidesk',accountId:5});
      assert.equal(lookup.body.progress.registered,index);
      const body={action:'save',teamId,memberId:ids[index],govtIdChecked:true,scanProof:lookup.body.scanProof};
      const result=await call(registration,body,{role:'regidesk',accountId:5});
      assert.equal(result.code,200);assert.equal(result.body.progress.registered,index+1);assert.equal(result.body.progress.total,ids.length);
      assert.equal((await call(registration,body,{role:"regidesk",accountId:5})).code,409);
      if(index===0 && ids.length>1) assert.equal((await call(registration,{...body,memberId:ids[1]},{role:'regidesk',accountId:5})).code,409);
    }
  }
  const lookup=async(accountId=3,slot='d1_breakfast')=>(await call(meal,{qrPayload:'ELEVATE1:'+'a'.repeat(32),mealSlotCode:slot},{accountId})).body;
  let scan=await lookup();assert.equal(scan.members[1].foodPreference,'Jain');
  assert.equal((await call(meal,{action:'log',teamId:1,mealSlotCode:'d1_breakfast',memberIds:[1,2],scanProof:scan.scanProof})).code,400);
  const body={action:'log',teamId:1,mealSlotCode:'d1_breakfast',memberIds:[1],scanProof:scan.scanProof};
  assert.equal((await call(meal,body)).body.logged,1);
  assert.equal((await sql`select count(*)::int as n from meal_logs`)[0].n,1);
  assert.equal((await call(meal,body)).code,409);
  assert.equal((await call(meal,{...body,memberIds:[2]})).code,409);
  const partial = await call(meal,null,{method:'GET',url:'/api/meal?resource=staff&slotCode=d1_breakfast'});
  assert.equal(partial.body.teams.length,0);assert.equal(partial.body.served,1);assert.equal(partial.body.directory[0].registered,4);
  const unchanged = await call(meal,null,{method:'GET',url:`/api/meal?resource=staff&slotCode=d1_breakfast&since=${partial.body.revision}`});
  assert.deepEqual(unchanged.body,{unchanged:true,revision:partial.body.revision});
  const analysis = await call(meal,null,{method:'GET',url:'/api/meal?resource=meal-analysis&slotCode=d1_breakfast'});
  assert.equal(analysis.body.teams.length,3);
  assert.equal(analysis.body.summary.total,9);
  assert.equal(analysis.body.summary.served,1);
  assert.equal(analysis.body.summary.partialTeams,1);
  assert.equal(analysis.body.summary.completeTeams,0);
  assert.deepEqual(analysis.body.summary.diets.Jain,{total:1,served:0});
  assert.equal(analysis.body.summary.counters['Counter A'],1);
  assert.equal(analysis.body.teams[0].members[0].served,true);
  assert.ok(analysis.body.teams[0].members[0].givenAt);
  assert.equal((await call(meal,null,{role:'team',teamId:1,method:'GET',url:'/api/meal?resource=meal-analysis&slotCode=d1_breakfast'})).code,403);
  assert.equal((await call(meal,null,{method:'GET',url:'/api/meal?resource=meal-analysis&slotCode=invalid'})).code,404);
  assert.equal((await call(meal,null,{method:'GET',url:`/api/meal?resource=meal-analysis&slotCode=d1_breakfast&since=${analysis.body.revision}`})).body.unchanged,true);
  const registry = await call(registration,null,{role:'regidesk',accountId:5,method:'GET',url:'/api/regidesk?resource=staff'});
  assert.equal(registry.body.directory.length,3);assert.equal(registry.body.directory[1].registered,2);
  scan=await lookup();assert.equal(scan.progress.served,1);
  assert.equal((await call(meal,{...body,memberIds:[2],scanProof:scan.scanProof})).body.logged,1);
  const [scanA,scanB]=await Promise.all([lookup(3),lookup(4)]);
  const concurrent=await Promise.all([call(meal,{...body,memberIds:[3],scanProof:scanA.scanProof},{accountId:3}),call(meal,{...body,memberIds:[3],scanProof:scanB.scanProof},{accountId:4})]);
  assert.equal(concurrent.reduce((total,r)=>total+r.body.logged,0),1);
  assert.equal((await sql`select count(*)::int as n from meal_logs where member_id=3`)[0].n,1);
  const receipt=await call(meal,null,{role:'team',teamId:1,method:'GET',url:'/api/meal?receipt=1'});assert.equal(receipt.body.meals.length,0);
  scan=await lookup();assert.equal((await call(meal,{...body,memberIds:[4],scanProof:scan.scanProof})).body.logged,1);
  const incoming=await call(meal,null,{role:'team',teamId:1,method:'GET',url:`/api/meal?receipt=1&after=${receipt.body.latestId}`});assert.equal(incoming.body.meals.length,1);assert.equal(incoming.body.meals[0].name,'Dev');
  const other=await call(meal,null,{role:'team',teamId:2,method:'GET',url:'/api/meal?receipt=1&after=0'});assert.equal(other.body.meals.length,0);
  assert.equal((await call(meal,null,{role:'team',teamId:1,method:'GET',url:'/api/meal?slotCode=d1_breakfast'})).code,403);
  assert.equal((await call(meal,body,{role:'team',teamId:1})).code,403);
  const breakfast=await call(meal,null,{method:'GET',url:'/api/meal?slotCode=d1_breakfast'});assert.equal(breakfast.body.served,4);assert.equal(breakfast.body.teams[0].members.length,4);
  const lunchScan=await lookup(3,'d1_lunch');
  assert.equal((await call(meal,{...body,mealSlotCode:'d1_lunch',scanProof:lunchScan.scanProof})).body.logged,1);
  const lunch=await call(meal,null,{method:'GET',url:'/api/meal?slotCode=d1_lunch'});assert.equal(lunch.body.served,1);assert.equal(lunch.body.teams.length,0);
  const complete=await call(meal,null,{method:'GET',url:`/api/meal?resource=staff&slotCode=d1_breakfast&since=${partial.body.revision}`});
  assert.equal(complete.body.teams.length,1);assert.notEqual(complete.body.revision,partial.body.revision);
  const completeAnalysis = await call(meal,null,{method:'GET',url:'/api/meal?resource=meal-analysis&slotCode=d1_breakfast'});
  assert.equal(completeAnalysis.body.summary.served,4);
  assert.equal(completeAnalysis.body.summary.completeTeams,1);
  assert.equal(completeAnalysis.body.summary.diets.Jain.served,1);
  const before=(await sql`select version from portal_revisions where domain='meals'`)[0].version;
  await assert.rejects(sql`insert into meal_logs (team_id,member_id,meal_slot_id,given_by) select 2,1,id,3 from meal_slots where code='d1_dinner'`);
  assert.equal((await sql`select version from portal_revisions where domain='meals'`)[0].version,before);
  await assert.rejects(sql`update registration_checkins set team_id=2 where member_id=1`);
  assert.equal((await call(meal,{action:'flag-low-stock',mealSlotCode:'d1_lunch',note:'test'})).code,410);
  assert.equal((await call(meal,{qrPayload:'https://unrelated.example',mealSlotCode:'d1_breakfast'})).code,400);
  assert.equal((await call(meal,{...body,memberIds:[99],scanProof:(await lookup()).scanProof})).code,409);
  assert.equal((await call(meal,{...body,mealSlotCode:'d1_lunch',scanProof:(await lookup()).scanProof})).code,409);
  const withdrawnScan=await lookup(3,'d1_dinner');await sql`update teams set withdrawn=true where id=1`;
  assert.equal((await call(meal,{...body,mealSlotCode:'d1_dinner',scanProof:withdrawnScan.scanProof})).code,409);
  const withdrawnAnalysis = await call(meal,null,{method:'GET',url:'/api/meal?resource=meal-analysis&slotCode=d1_breakfast'});
  assert.equal(withdrawnAnalysis.body.teams.length,3);
  assert.equal(withdrawnAnalysis.body.summary.total,5);
  assert.equal(withdrawnAnalysis.body.summary.served,0);
  assert.equal((await call(core,null,{role:'admin',accountId:7,method:'GET'})).body.teams.length,3);
  // Exercise the actual destructive importer only in this disposable cluster.
  for (let i=1;i<=35;i++) {
    const code=`ELEV${String(i).padStart(2,'0')}`;
    await sql`insert into accounts (id,username,password_hash,role,display_name) values (${100+i},${code.toLowerCase()},'preserved-hash','team','Old placeholder')`;
    await sql`insert into teams (id,account_id,team_code,seat_no,qr_token) values (${100+i},${100+i},${code},${i},${i.toString(16).padStart(32,'0')})`;
  }
  // Fixture inserts use explicit IDs, so align sequences before importing.
  await sql`select setval('team_members_id_seq',(select max(id) from team_members))`;
  const finalData={version:1,sourceHash:'fixture-only',teams:Array.from({length:32},(_,i)=>({teamName:`Final ${i+1}`,sourceRow:i+2,declaredSize:2+i%3,issues:[],respondedAt:null,respondentEmail:null,paymentPayers:[],termsConfirmation:null,declaration:null,
    members:Array.from({length:2+i%3},(_,m)=>({position:m+1,name:`Final Person ${i+1}/${m+1}`,isLead:m===0,email:`p${i}-${m}@example.com`,phone:'+919876543210',college:'Fixture College',yearBranch:'CSE',foodPreference:m===1?'Jain':'Veg'}))}))};
  const issued=await sql`select t.*,a.username from teams t join accounts a on a.id=t.account_id`;
  const assignments=validateFinalists(finalData,issued);
  const builder=(strings,...values)=>strings.reduce((text,piece,index)=>text+piece+(index<values.length?literal(values[index]):''),'');
  builder.query=text=>text;
  const teamTables=['core_assignments','core_recusals','event_checkins','incidents','marks','meal_logs','registration_checkins','round1_notes','submission_files','team_ps_selection','team_rsvp_details'];
  const reset=resetStatements(builder,finalData,assignments,teamTables);
  await exec('psql',[...params,'-c','begin;'+reset.join(';')+';commit;']);
  assert.equal((await sql`select count(*)::int as n from teams`)[0].n,32);
  assert.equal((await sql`select count(*)::int as n from accounts where role='team'`)[0].n,32);
  assert.equal((await sql`select count(*)::int as n from accounts where role='team' and password_hash='preserved-hash'`)[0].n,32);
  assert.equal((await sql`select count(*)::int as n from meal_logs`)[0].n,0);
  assert.equal((await sql`select count(*)::int as n from registration_checkins`)[0].n,0);
  assert.equal((await sql`select count(*)::int as n from team_members where is_lead`)[0].n,32);
  const finalRegistry=await call(registration,null,{role:'regidesk',accountId:5,method:'GET',url:'/api/regidesk?resource=staff'});
  assert.equal(finalRegistry.body.directory.length,32);
  for (const index of [1,2,3]) {
    const token=index.toString(16).padStart(32,'0'), total=2+(index-1)%3, teamId=100+index;
    for(let member=0;member<total;member++) {
      const scan=await call(registration,{qrPayload:`ELEVATE1:${token}`},{role:'regidesk',accountId:5});
      const person=scan.body.members[member];
      assert.equal(scan.body.progress.total,total);
      assert.equal((await call(registration,{action:'save',teamId,memberId:person.id,govtIdChecked:true,scanProof:scan.body.scanProof},{role:'regidesk',accountId:5})).code,200);
      const redemption=await call(meal,{qrPayload:`ELEVATE1:${token}`,mealSlotCode:'d1_lunch'});
      assert.equal((await call(meal,{action:'log',teamId,mealSlotCode:'d1_lunch',memberIds:[person.id],scanProof:redemption.body.scanProof})).code,200);
      const list=await call(meal,null,{method:'GET',url:'/api/meal?resource=staff&slotCode=d1_lunch'});
      assert.equal(list.body.teams.some(t=>t.id===teamId),member===total-1);
    }
  }
  console.log('PASS: meal analysis includes partial/complete/waiting teams, preferences, timestamps/counters, revision refresh, privacy and withdrawal totals; admin sees all teams and final score/two feedback writes, release privacy and targeted announcement isolation validate and reset release status.');
  console.log('PASS: finalist replacement transaction; 35→32 accounts; leader/seat/QR/profile mapping; passwords preserved; old scans cleared; imported 2/3/4-person team QR registration and meal completion lists.');
  console.log('PASS: 2/3/4-person repeated team QR registration; single-use proofs; atomic meal writes; concurrent counters; immediate database reads; food preferences; slot history; private participant receipts; invalid QR/ownership/slot/withdrawal checks.');
} finally {
  if(started) await exec('pg_ctl',['-D',data,'-m','fast','-w','stop']);
  await fs.rm(folder,{recursive:true,force:true});
}
