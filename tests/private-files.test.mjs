import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createServer} from 'vite';
import {privateFileDeny} from '../vite.config.js';

test('Vite denies private RSVP, QA, environment and credential files via direct and @fs URLs',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'elevate-private-'));
 const files=['.env','.env.production','.local-rsvp/participants.json','.local-rsvp/backup.json','.local-release-check/result.json','db/credentials.generated.json','db/elevate-login-credentials.csv'];
 const secret='isolated-private-file-fixture';
 for(const file of files){await fs.mkdir(path.dirname(path.join(root,file)),{recursive:true});await fs.writeFile(path.join(root,file),secret);}
 await fs.writeFile(path.join(root,'index.html'),'<h1>Public site</h1>');
 const server=await createServer({root,configFile:false,logLevel:'silent',server:{host:'127.0.0.1',port:0,fs:{allow:[root],deny:privateFileDeny}}});
 try {
  await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`;
  for(const file of files)for(const url of [`/${file}`,`/@fs${path.join(root,file)}`]) {
   const response=await fetch(base+url);assert.equal(response.status,403,`${url} must be denied`);assert.ok(!(await response.text()).includes(secret));
  }
  assert.equal((await fetch(base+'/')).status,200);
 } finally {await server.close();await fs.rm(root,{recursive:true,force:true});}
});
