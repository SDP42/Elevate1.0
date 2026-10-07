import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import JSZip from 'jszip';
process.env.DATABASE_URL='postgresql://fixture:fixture@localhost/security_fixture';
process.env.SESSION_SECRET='isolated-security-regression-fixture-secret';
const {createAuthHandler}=await import('../api/auth.js');
const {createSubmissionFiles}=await import('../api/_lib/submission-files.js');
const {signSession,verifySession,requireRole,sessionCookie}=await import('../api/_lib/auth.js');
const {issueScanProof}=await import('../api/_lib/scan-proof.js');

function fixture() {
 const account={id:1,username:'elev01',role:'team',display_name:'Fixture Flight',password_hash:bcrypt.hashSync('fixture-password',4)};
 const state={files:[{id:22,team_id:2,kind:'txt',name:'other.txt',mime_type:'text/plain',size:5,base64:Buffer.from('other').toString('base64')}],attempts:[],queries:[]};
 async function sql(strings,...values) {
  const query=strings.join('?').replace(/\s+/g,' ').trim().toLowerCase();state.queries.push({query,values});
  if(query.startsWith('delete from login_attempts')) {
   if(query.includes('username')) state.attempts=state.attempts.filter(u=>u!==values[0]);return [];
  }
  if(query.startsWith('select count(*) as n from login_attempts'))return [{n:state.attempts.filter(u=>u===values[0]).length}];
  if(query.startsWith('insert into login_attempts')){state.attempts.push(values[0]);return [];}
  if(query.startsWith('select id, username, password_hash'))return values[0]===account.username?[account]:[];
  if(query.startsWith('select id,display_name from accounts'))return values[0]===account.id&&values[1]===account.role?[account]:[];
  if(query.startsWith('select id, team_code, seat_no, qr_token'))return [{id:1,team_code:'ELEV01',seat_no:1,qr_token:'a'.repeat(32)}];
  if(query.includes('from submission_files')) {
   const files=query.includes('where id =')?state.files.filter(f=>f.id===values[0]&&f.team_id===values[1]):state.files.filter(f=>f.team_id===values[0]);
   return files.map(f=>query.includes('encode(content')?f:(({base64:_base64,team_id:_teamId,...metadata})=>metadata)(f));
  }
  if(query.startsWith('insert into submission_files')) {
   const [team_id,kind,name,mime_type,size,base64]=values;
   const file={id:100+state.files.length,team_id,kind,name,mime_type,size,base64};state.files.push(file);
   const {base64:_content,team_id:_owner,...metadata}=file;return [metadata];
  }
  if(query.startsWith('update teams set submitted_at'))return [];
  throw new Error(`Unexpected fixture query: ${query}`);
 }
 const uploads=createSubmissionFiles({sql,logAction:async()=>{}});
 const handler=createAuthHandler({sql,submissionFiles:uploads,logAction:async()=>{},createIncident:async()=>{}});
 const token=role=>signSession({accountId:1,role,teamId:role==='team'?1:undefined,displayName:'Fixture Flight'});
 async function call(body,{role='team',cookie=role?token(role):'',method='POST',url='/api/auth',headers={}}={}) {
  const response={headers:{},statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;},setHeader(k,v){this.headers[k]=v;}};
  await handler({method,url,body,headers:{host:'fixture.local',cookie:cookie?`elevate_session=${cookie}`:'',...headers}},response);return response;
 }
 return {state,account,call,token};
}
const upload=(name,bytes)=>({action:'upload',name,base64:Buffer.from(bytes).toString('base64')});

test('JWT rejects expired tokens, none/alternate algorithms, wrong keys and scan purposes',()=>{
 assert.equal(verifySession(jwt.sign({role:'admin'},process.env.SESSION_SECRET,{expiresIn:-1})),null);
 assert.equal(verifySession(jwt.sign({role:'admin'},'wrong-fixture-secret')),null);
 assert.equal(verifySession(jwt.sign({role:'admin'},process.env.SESSION_SECRET,{algorithm:'HS384'})),null);
 const unsigned=Buffer.from('{"alg":"none"}').toString('base64url')+'.'+Buffer.from('{"role":"admin"}').toString('base64url')+'.';
 assert.equal(verifySession(unsigned),null);
 assert.equal(verifySession(issueScanProof('meal',1,2,'d1_lunch')),null);
 const old=process.env.VERCEL_ENV;process.env.VERCEL_ENV='production';assert.match(sessionCookie('fixture'),/; Secure/);
 if(old===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=old;
});
test('uploads reject unauthenticated and unauthorized staff roles without touching storage',async()=>{
 for(const role of [null,'core','meal','regidesk','admin','superadmin']) {
  const {call,state}=fixture(),result=await call(upload('sample.txt','hello'),{role});
  assert.equal(result.statusCode,role===null?401:403);assert.equal(state.queries.length,0);
 }
});
test('submission reads bind file ownership to team session and never body/query teamId',async()=>{
 const {call,state}=fixture();
 const list=await call(null,{method:'GET',url:'/api/auth?resource=submission-files&teamId=2'});
 assert.deepEqual(list.body.files,[]);
 assert.equal((await call(null,{method:'GET',url:'/api/auth?resource=submission-files&teamId=2&fileId=22'})).statusCode,404);
 const result=await call({...upload('mine.txt','safe'),teamId:2});assert.equal(result.statusCode,200);
 assert.equal(state.files.at(-1).team_id,1);
 assert.equal((await call(null,{role:'meal',method:'GET',url:'/api/auth?resource=submission-files&teamId=2'})).statusCode,403);
 assert.equal((await call(null,{role:'admin',method:'GET',url:'/api/auth?resource=submission-files&teamId=2&fileId=22'})).body.file.id,22);
});
test('upload validation blocks disguised executables, corrupt encodings, invalid PDF/PPTX and unsafe text',async()=>{
 const invalid=[upload('payload.exe','data'),upload('fake.pdf','not pdf'),upload('fake.pptx','not zip'),upload('null.txt',Buffer.from([0])),upload('utf8.md',Buffer.from([255,254])),
  {action:'upload',name:'test.txt',base64:'%%%%'},{action:'upload',name:'test.txt',base64:'Zh=='},upload('big.txt',Buffer.alloc(3*1024*1024+1,65))];
 for(const body of invalid){const {call,state}=fixture();assert.ok([400,413].includes((await call(body)).statusCode));assert.equal(state.queries.length,0);}
});
test('valid PDF/PPTX/MD/TXT are accepted; names are sanitized and bytes are not returned in metadata',async()=>{
 const zip=new JSZip();zip.file('[Content_Types].xml','<Types/>');zip.file('ppt/presentation.xml','<presentation/>');
 const deck=await zip.generateAsync({type:'nodebuffer'});
 for(const [name,bytes] of [['demo.pdf','%PDF-1.7\nfixture'],['demo.pptx',deck],['../demo.md','# Safe\n<script>alert(1)</script>'],['demo.txt','hello']]) {
  const {call,state}=fixture(),result=await call(upload(name,bytes));assert.equal(result.statusCode,200);
  assert.doesNotMatch(result.body.file.name,/[/\\]/);assert.equal(result.body.file.base64,undefined);assert.equal(state.files.at(-1).team_id,1);
 }
});
test('PPTX rejects excessive entry count and decompression bombs',async()=>{
 for(const mode of ['count','expanded']) {
  const zip=new JSZip();zip.file('[Content_Types].xml','<Types/>');zip.file('ppt/presentation.xml','<presentation/>');
  if(mode==='count')for(let i=0;i<2001;i++)zip.file(`entry${i}.txt`,'x');
  else zip.file('large.txt',Buffer.alloc(31*1024*1024,65));
  const bytes=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
  const {call,state}=fixture();assert.equal((await call(upload('bomb.pptx',bytes))).statusCode,400);assert.equal(state.queries.length,0);
 }
});
test('cross-site file writes and unsafe submission URLs are rejected',async()=>{
 const {call,state}=fixture();
 assert.equal((await call(upload('safe.txt','safe'),{headers:{origin:'https://evil.example'}})).statusCode,403);
 assert.equal(state.queries.length,0);
 for(const link of ['javascript:alert(1)','data:text/html,test','file:///etc/passwd'])assert.equal((await call({action:'submit',submissionUrl:link})).statusCode,400);
});
test('login rejects malformed bodies; SQL-like usernames are bound parameters; sequential lockout applies',async()=>{
 const {call,state}=fixture();
 for(const body of [{},{username:1,password:'x'},{username:'x',password:{}},{username:'x',password:'x'.repeat(1025)}])assert.equal((await call(body,{role:null})).statusCode,400);
 const injected="' or 1=1 --";assert.equal((await call({username:injected,password:'invalid'},{role:null})).statusCode,401);
 assert.ok(state.queries.some(q=>q.values.includes(injected)&&!q.query.includes(injected)));
 for(let i=0;i<8;i++)assert.equal((await call({username:'ELEV01',password:'invalid'},{role:null})).statusCode,401);
 assert.equal((await call({username:'elev01',password:'invalid'},{role:null})).statusCode,429);
});
test('login normalizes ELEV usernames, sends HttpOnly cookies and never returns password hashes',async()=>{
 const {call}=fixture(),result=await call({username:' ELEV01 ',password:'fixture-password'},{role:null});
 assert.equal(result.statusCode,200);assert.match(result.headers['Set-Cookie'],/HttpOnly; SameSite=Lax/);
 assert.doesNotMatch(JSON.stringify(result.body),/password_hash|fixture-password/);
});
test('documented finding: resetting password does not invalidate an already-issued session',async()=>{
 const {call,account,token}=fixture();const before=token('team');
 account.password_hash=bcrypt.hashSync('replacement-fixture-password',4);
 assert.equal((await call(null,{cookie:before,method:'GET',url:'/api/auth?resource=submission-files'})).statusCode,200);
});
test('documented finding: concurrent failed logins can exceed the sequential eight-attempt threshold',async()=>{
 const {call,state}=fixture();
 const results=await Promise.all(Array.from({length:12},()=>call({username:'elev01',password:'invalid'},{role:null})));
 assert.equal(results.filter(r=>r.statusCode===401).length,12);assert.equal(state.attempts.length,12);
});
test('documented finding: protected role wrapper trusts an unexpired token without checking current account existence',async()=>{
 let executed=false;const wrapped=requireRole((req,res)=>{executed=true;res.status(200).json({ok:true});},['admin']);
 const response={setHeader(){},status(code){this.statusCode=code;return this;},json(){}};
 await wrapped({method:'GET',headers:{cookie:`elevate_session=${signSession({accountId:999999,role:'admin'})}`}},response);
 assert.equal(executed,true);assert.equal(response.statusCode,200);
});
