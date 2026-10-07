import assert from 'node:assert/strict';
import test from 'node:test';
import { validateFinalists, resetStatements } from '../db/replace-finalists.mjs';

const teams=Array.from({length:35},(_,i)=>({id:i+1,account_id:i+1,team_code:`ELEV${String(i+1).padStart(2,'0')}`,username:`elev${String(i+1).padStart(2,'0')}`}));
const source=()=>({version:1,sourceHash:'fixture',teams:Array.from({length:32},(_,i)=>({teamName:`Fixture ${i+1}`,declaredSize:2,issues:[],members:[1,2].map(n=>({position:n,isLead:n===1,name:`Member ${i+1}/${n}`,email:`person${i+1}-${n}@example.com`,phone:'+919876543210',foodPreference:n===1?'Veg':'Jain'}))}))});
test('final roster maps CSV order to exactly 32 issued identities and seats',()=>{
 const result=validateFinalists(source(),teams);
 assert.equal(result.length,32);assert.equal(result[31].team.team_code,'ELEV32');assert.equal(result[31].seat,32);
});
test('final replacement rejects incomplete, duplicate and invalid rosters',()=>{
 for(const mutate of [d=>d.teams.pop(),d=>d.teams[1].teamName=d.teams[0].teamName,d=>d.teams[0].members[0].foodPreference='',d=>d.teams[0].members[1].isLead=true,d=>d.teams[1].members[0].email=d.teams[0].members[0].email,d=>d.teams[0].members[0].college='https://drive.google.com/test']) {
  const data=source();mutate(data);assert.throws(()=>validateFinalists(data,teams));
 }
 assert.throws(()=>validateFinalists(source(),teams.slice(0,31)));
});
test('explicit reset clears replaced activity, removes spare accounts and never writes password hashes',()=>{
 const queries=[];
 const sql=(strings,...values)=>({text:strings.join('?'),values});
 sql.query=(text)=>({text,values:[]});
 const data=source(), assignments=validateFinalists(data,teams);
 queries.push(...resetStatements(sql,data,assignments,['meal_logs','registration_checkins','submission_files','team_members','team_rsvp_details']));
 assert.ok(queries.some(q=>q.text.includes('delete from "meal_logs"')));
 assert.ok(queries.some(q=>q.text.includes("delete from accounts where role='team'")));
 assert.equal(queries.filter(q=>q.text.includes('insert into team_members')).length,64);
 assert.equal(queries.filter(q=>q.text.includes('insert into team_rsvp_details')).length,32);
 assert.ok(queries.every(q=>!q.text.includes('password_hash')));
});
