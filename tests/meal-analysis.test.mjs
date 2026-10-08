import assert from 'node:assert/strict';
import test from 'node:test';
import { mealAnalysis } from '../api/_lib/meal-analysis.js';
const row = (overrides = {}) => ({code:'d1_breakfast',label:'Breakfast',day_no:1,
  team_id:1,team_code:'ELEV01',team_name:'Fixture One',seat_no:1,withdrawn:false,
  member_id:1,name:'Ada',is_lead:true,preference:'Veg',scan_id:null,given_at:null,counter:null,...overrides});

test('meal analysis includes partial teams and pending members with correct dietary and counter totals', async () => {
  let parameter;
  const sql = async (_strings, value) => { parameter=value;return [
    row({scan_id:10,given_at:'2026-10-10T03:00:00Z',counter:'Counter A'}),
    row({member_id:2,name:'Bea',is_lead:false,preference:'Jain'}),
    row({team_id:2,team_code:'ELEV02',team_name:'Fixture Two',member_id:3,name:'Chen',preference:null,is_lead:false}),
  ]; };
  const result=await mealAnalysis(sql,'d1_breakfast');
  assert.equal(parameter,'d1_breakfast');assert.equal(result.teams.length,2);
  assert.equal(result.teams[0].served,1);assert.equal(result.teams[0].total,2);
  assert.equal(result.teams[0].members[0].givenAt,'2026-10-10T03:00:00Z');
  assert.equal(result.teams[0].members[1].served,false);
  assert.deepEqual(result.summary,{total:3,served:1,completeTeams:0,partialTeams:1,waitingTeams:1,
    diets:{Veg:{total:1,served:1},Jain:{total:1,served:0},Unspecified:{total:1,served:0}},counters:{'Counter A':1}});
});

test('withdrawn teams stay in history but do not inflate active totals or food requirements',async()=>{
  const result=await mealAnalysis(async()=>[
    row({scan_id:1,counter:'Counter A'}),
    row({team_id:2,team_code:'ELEV02',withdrawn:true,member_id:2,preference:'Jain',scan_id:2}),
  ],'d1_breakfast');
  assert.equal(result.teams.length,2);assert.equal(result.summary.total,1);
  assert.equal(result.summary.served,1);assert.equal(result.summary.completeTeams,1);
  assert.deepEqual(result.summary.diets,{Veg:{total:1,served:1}});
});

test('invalid slots return null; empty slots do not invent teams or participants',async()=>{
  assert.equal(await mealAnalysis(async()=>[],'invalid'),null);
  const result=await mealAnalysis(async()=>[row({team_id:null,member_id:null})],'d1_breakfast');
  assert.deepEqual(result.teams,[]);assert.equal(result.summary.total,0);
  assert.deepEqual(result.summary.diets,{});
});
