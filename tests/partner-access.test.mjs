import test from 'node:test';
import assert from 'node:assert/strict';
import { partnerAccess } from '../api/_lib/partner-access.js';
const env={PARTNER_ACCESS_PASSWORD:'test-only',PARTNER_ACCESS_LABEL:'Wi-Fi access'};
test('Wi-Fi mapping assigns exactly one numbered account to each finalist',()=>{
  const accounts=Array.from({length:32},(_,i)=>partnerAccess(`ELEV${String(i+1).padStart(2,'0')}`,env));
  assert.equal(new Set(accounts.map(a=>a.username)).size,32);
  assert.equal(accounts[0].username,'Elevate1');assert.equal(accounts[31].username,'Elevate32');
  assert.ok(accounts.every(a=>a.password==='test-only'&&a.label==='Wi-Fi access'&&a.url===null));
});
test('Wi-Fi access fails closed for missing config or unknown team codes',()=>{
  for(const code of ['ELEV00','ELEV33','ELEV50','ELEV1','team01',null,'ELEV01foo']) assert.equal(partnerAccess(code,env),null);
  assert.equal(partnerAccess('ELEV01',{}),null);
});
process.env.DATABASE_URL='postgresql://fixture:fixture@localhost/partner_fixture';
process.env.SESSION_SECRET='partner-test-session-secret';
process.env.PARTNER_ACCESS_PASSWORD='test-only';
process.env.PARTNER_ACCESS_LABEL='Wi-Fi access';
const {createAuthHandler}=await import('../api/auth.js');
const {createAdminHandler}=await import('../api/admin.js');
const {signSession,requireRole}=await import('../api/_lib/auth.js');
function response(){return {headers:{},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;},setHeader(k,v){this.headers[k]=v;}};}
function request(role,teamId=1,url='/api/auth') {return {method:'GET',url,headers:{host:'fixture.local',cookie:role?`elevate_session=${signSession({accountId:teamId,teamId:role==='team'?teamId:undefined,role})}`:''}};}
test('participant Wi-Fi access is bound to the signed session, not a query team ID',async()=>{
 const queries=[];
 const sql=async(strings,...values)=>{
  const q=strings.join('?').replace(/\s+/g,' ');queries.push({q,values});
  if(q.includes('from accounts'))return [{id:values[0],display_name:'Test team'}];
  if(q.includes('from teams'))return [{id:values[0],team_code:`ELEV${String(values[0]).padStart(2,'0')}`}];
  return [];
 };
 const handler=createAuthHandler({sql,logAction:async()=>{}});
 const res=response();await handler(request('team',2,'/api/auth?teamId=1'),res);
 assert.equal(res.statusCode,200);assert.equal(res.body.team.partnerAccess.username,'Elevate2');
 assert.equal(res.body.team.partnerAccess.password,'test-only');assert.equal(res.headers['Cache-Control'],'private, no-store');
 assert.equal(queries.find(({q})=>q.includes('from teams')).values[0],2);
 const unauth=response();await handler(request(null),unauth);assert.equal(unauth.statusCode,401);assert.ok(!unauth.body.team);
 const staff=response();await handler(request('meal'),staff);assert.equal(staff.body.team,null);
});
test('only admin roles can list all team Wi-Fi assignments',async()=>{
 let queries=0;
 const sql=async(strings)=>{queries++;return strings.join('').includes('from teams')?[{id:1,team_code:'ELEV01',display_name:'Team 1',meals_claimed:0}]:[];};
 const handler=requireRole(createAdminHandler({sql,logAction:async()=>{}}),["admin","superadmin"]);
 for(const role of [null,'team','meal','regidesk','core']) {const res=response();const before=queries;await handler(request(role,1,'/api/admin?resource=teams'),res);assert.equal(res.statusCode,401);assert.equal(queries,before);}
 for(const role of ['admin','superadmin']){const res=response();await handler(request(role,1,'/api/admin?resource=teams'),res);assert.equal(res.statusCode,200);assert.equal(res.body.teams[0].partnerAccess.username,'Elevate1');assert.match(res.headers['Cache-Control'],/no-store/);}
});
