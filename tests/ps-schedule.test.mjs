import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { PS_SELECTION_OPENS_AT, PS_SELECTION_CLOSES_AT, psSelectionSchedule } from '../shared/ps-schedule.js';

process.env.DATABASE_URL ||= 'postgresql://fixture:fixture@localhost/elevate_fixture';
process.env.SESSION_SECRET ||= randomBytes(48).toString('hex');
const { createPsHandler } = await import('../api/ps.js');
const opening = Date.parse(PS_SELECTION_OPENS_AT);
const response = () => ({ status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
const request = method => ({ method, session: { role: 'team', teamId: 1 }, body: { preferences: [1,2,3,4] } });

test('organizer early opening on 10 October 2026 is inclusive', () => {
  assert.equal(opening, Date.parse('2026-10-10T00:00:00+05:30'));
  assert.equal(psSelectionSchedule(opening - 1).selectionOpen, false);
  assert.equal(psSelectionSchedule(opening).selectionOpen, true);
  assert.equal(psSelectionSchedule(opening + 1).selectionOpen, true);
});

test('participant reads hide details and premature writes cannot reach the database', async () => {
  const sql = () => { throw new Error('Premature database access'); };
  sql.transaction = sql;
  const handler = createPsHandler({ sql, now: () => opening - 1 });
  const read = response(); await handler(request('GET'), read);
  assert.equal(read.code, 200);
  assert.deepEqual(read.body.problemStatements, []);
  assert.deepEqual(read.body.allocations, []);
  assert.equal(read.body.selectionOpen, false);
  assert.equal(read.body.opensAt, PS_SELECTION_OPENS_AT);
  const write = response(); await handler(request('POST'), write);
  assert.equal(write.code, 403);
  assert.equal(write.body.selectionOpen, false);
  // Device-supplied time and flags cannot override the server gate.
  const forged = request('POST'); forged.body.selectionOpen = true;
  forged.body.serverNow = '2099-01-01T00:00:00Z';
  const rejected = response(); await handler(forged, rejected);
  assert.equal(rejected.code, 403);
});

test('staff can inspect configuration before opening', async () => {
  let queries = 0;
  const sql = async () => { queries++; return []; };
  const handler = createPsHandler({ sql, now: () => opening - 1 });
  for (const role of ['admin','core','superadmin']) {
    const res = response(); await handler({ method:'GET',session:{role} }, res);
    assert.equal(res.code, 200); assert.equal(res.body.selectionOpen, false);
  }
  assert.equal(queries, 6);
});

test('submission reaches the atomic allocator at and after opening', async () => {
  for (const now of [opening, opening + 1]) {
    let transactions = 0;
    const sql = () => [];
    sql.transaction = async callback => {
      transactions++; assert.equal(callback(sql).length, 5);
      return [[],[],[{team_id:1}],[{ps_id:4,status:'approved'}],[{ps_id:4,status:'approved'}]];
    };
    const res = response(); await createPsHandler({sql,now:()=>now})(request('POST'), res);
    assert.equal(res.code, 200); assert.equal(res.body.selection.ps_id, 4);
    assert.equal(transactions, 1);
  }
});

 test('10 AM IST cutoff blocks new allocations but keeps statements readable', async () => {
 const close=Date.parse(PS_SELECTION_CLOSES_AT);
 assert.equal(close,Date.parse('2026-10-10T10:00:00+05:30'));
 assert.equal(psSelectionSchedule(close-1).selectionOpen,true);
 assert.equal(psSelectionSchedule(close).selectionOpen,false);
 const sql=async()=>[]; sql.transaction=()=>{throw new Error('Closed allocation reached DB');};
 const handler=createPsHandler({sql,now:()=>close});
 const write=response();await handler(request('POST'),write);assert.equal(write.code,403);
 const read=response();await handler(request('GET'),read);assert.equal(read.code,200);assert.equal(read.body.selectionClosed,true);
 });
