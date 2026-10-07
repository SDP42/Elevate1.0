import assert from "node:assert/strict";
import { test } from "node:test";
import jwt from "jsonwebtoken";
import { parseQrToken, parseMealRequest } from "../shared/meal.js";
import { issueScanProof, verifyScanProof } from "../api/_lib/scan-proof.js";
import { buildImportPlan } from "../db/import-rsvp.mjs";

test("team QR parser rejects arbitrary URLs and nonstring values",()=>{
  const token="a".repeat(32);
  assert.equal(parseQrToken(`  ELEVATE1:${token}  `),token);
  assert.equal(parseQrToken(token),token);
  for(const value of [null,5,{},"https://example.com","ELEVATE1:bad"])assert.equal(parseQrToken(value),null);
});
test("each meal redemption contains exactly one distinct participant",()=>{
  assert.deepEqual(parseMealRequest({teamId:1,mealSlotCode:"d1_lunch",memberIds:[2]}).memberIds,[2]);
  for(const ids of [[],[1,2],[1,1],["1"],[-1]])assert.throws(()=>parseMealRequest({teamId:1,mealSlotCode:"d1_lunch",memberIds:ids}));
});
test("scan proofs bind team, counter, purpose and meal slot and cannot authenticate a session",()=>{
  process.env.SESSION_SECRET="fixture-only-secret-with-no-live-credentials";
  const proof=issueScanProof("meal",1,3,"d1_lunch");
  assert.ok(verifyScanProof(proof,"meal",1,3,"d1_lunch"));
  for(const args of [["meal",2,3,"d1_lunch"],["meal",1,4,"d1_lunch"],["registration",1,3,null],["meal",1,3,"d1_breakfast"]]) assert.equal(verifyScanProof(proof,...args),null);
  assert.throws(()=>jwt.verify(proof,process.env.SESSION_SECRET));
  assert.equal(verifyScanProof("tampered","meal",1,3,"d1_lunch"),null);
});
const source={version:1,teams:[{teamName:"Example Flight",declaredSize:2,issues:[],members:[{position:1,name:"Ada",foodPreference:"Veg"},{position:2,name:"Bea",foodPreference:"Jain"}]}]};
const teams=[{id:1,username:"team01",account_id:1}];
const members=[{id:11,team_id:1,name:"T1M1",sort_order:1},{id:12,team_id:1,name:"T1M2",sort_order:2},{id:13,team_id:1,name:"T1M3",sort_order:3}];
const mapping=[{sourceTeam:"Example Flight",username:"team01"}];
test("RSVP import requires account mapping and preserves existing member IDs",()=>{
  assert.equal(buildImportPlan(source,[],teams,members).problems.length,1);
  const plan=buildImportPlan(source,mapping,teams,members);
  assert.equal(plan.problems.length,0);assert.deepEqual(plan.assignments[0].members.map(m=>m.id),[11,12]);assert.deepEqual(plan.assignments[0].removeIds,[13]);
});
test("RSVP import rejects reassigning or deleting identities with event history",()=>{
  assert.ok(buildImportPlan(source,mapping,teams,members,[11]).problems.length);
  assert.ok(buildImportPlan(source,mapping,teams,members,[13]).problems.length);
  const actual=members.map(m=>({...m,name:m.id===11?"Someone Else":m.name}));
  assert.ok(buildImportPlan(source,mapping,teams,actual).problems.length);
});
test("RSVP size mismatch requires an explicit roster decision and missing food preferences fail",()=>{
  const mismatch=structuredClone(source);mismatch.teams[0].members.push({position:3,name:"Chen",foodPreference:null});mismatch.teams[0].issues=["Declared size 2; 3 names supplied"];
  assert.ok(buildImportPlan(mismatch,mapping,teams,members).problems.length);
  assert.equal(buildImportPlan(mismatch,[{...mapping[0],memberPositions:[1,2]}],teams,members).problems.length,0);
  assert.ok(buildImportPlan(mismatch,[{...mapping[0],memberPositions:[1,3]}],teams,members).problems.length);
});
test("Drive links are rejected even when they occur outside upload columns",()=>{
  const privateSource=structuredClone(source);privateSource.teams[0].members[0].college="https://drive.google.com/open?id=example";
  assert.throws(()=>buildImportPlan(privateSource,mapping,teams,members),/Drive links/);
});


import { teamCode, issuedTeamNumber } from "../shared/team-code.js";
import { identityPlan } from "../db/team-identities.mjs";
test("ELEV identities preserve account ownership and reject collisions",()=>{
 assert.equal(teamCode(1),"ELEV01");assert.equal(teamCode(32),"ELEV32");assert.equal(issuedTeamNumber("team01"),1);assert.equal(issuedTeamNumber("elev01"),1);
 const legacy=[{id:1,account_id:2,username:"team01",team_code:"T1"}];
 const plan=identityPlan(legacy,[{id:2,username:"team01"}]);
 assert.deepEqual(plan.problems,[]);assert.equal(plan.changes[0].username,"ELEV01");assert.equal(plan.changes[0].accountId,2);
 assert.ok(identityPlan(legacy,[{id:2,username:"team01"},{id:3,username:"elev01"}]).problems.length);
 assert.equal(buildImportPlan(source,[{...mapping[0],username:"ELEV01"}],teams,members).problems.length,0);
});
