import { mealAnalysis } from "./_lib/meal-analysis.js";
import { staffRevision, mealSnapshot } from "./_lib/staff-sync.js";
import { sql as defaultSql } from "./_lib/db.js";
import { requireRole } from "./_lib/auth.js";
import { logAction as defaultLogAction } from "./_lib/audit.js";
import { createIncident as defaultCreateIncident } from "./_lib/incidents.js";
import { searchParams } from "./_lib/http.js";
import { issueScanProof, verifyScanProof } from "./_lib/scan-proof.js";
import { parseMealRequest, parseQrToken } from "../shared/meal.js";


/* Meal (and admin) only: the scan lookup, the manual-code fallback, the
   confirm-and-log step, and the running tally all share this file — see
   api/auth.js for why. GET is the tally; POST's `action` picks the write
   ("log" logs, "lookup-by-code" looks up by typed team code instead of a
   camera scan, "log-guest" raises an incident for admin,
   anything else is the normal QR lookup). */
export function createMealHandler({ sql = defaultSql, logAction = defaultLogAction, createIncident = defaultCreateIncident } = {}) {
async function handler(req, res) {
  if (req.session.role === "team") {
    if (req.method === "GET" && searchParams(req).get("receipt") === "1") return receipt(req, res);
    return res.status(403).json({ error: "This action is for meal counters" });
  }
  if (req.method === "GET" && searchParams(req).get("resource") === "meal-analysis") {
    const revision = await staffRevision(sql, req, res);
    if (revision === null) return;
    const analysis = await mealAnalysis(sql, searchParams(req).get("slotCode"));
    if (!analysis) return res.status(404).json({ error: "Unknown meal slot" });
    return res.status(200).json({ ...analysis, revision, updatedAt: new Date().toISOString() });
  }
  if (req.method === "GET" && searchParams(req).get("resource") === "staff") return staffSnapshot(req, res);
  if (req.method === "GET") return searchParams(req).has("slotCode") ? history(req, res) : tally(req, res);
  if (req.method === "POST") {
    const { action } = req.body || {};
    if (action === "log") return logMeal(req, res);
    if (action === "undo") return undoMeal(req, res);
    if (action === "lookup-by-code") return lookupByCode(req, res);
    if (action === "flag-low-stock") return res.status(410).json({ error: "This option has been removed" });
    if (action === "log-guest") return logGuest(req, res);
    return lookup(req, res);
  }
  res.status(405).json({ error: "Method not allowed" });
}

/* how many members have been served at each slot so far — lets a counter
   self-monitor without asking admin */
async function tally(req, res) {
  const rows = await sql`
    select ms.code, ms.label, ms.day_no, count(ml.id) as served
    from meal_slots ms
    left join meal_logs ml on ml.meal_slot_id = ms.id
    group by ms.id, ms.code, ms.label, ms.day_no
    order by ms.sort_order asc
  `;
  res.status(200).json({
    slots: rows.map((r) => ({ code: r.code, label: r.label, dayNo: r.day_no, served: Number(r.served) })),
  });
}

async function receipt(req, res) {
  const afterValue = searchParams(req).get("after");
  const after = afterValue === null ? null : Number(afterValue);
  if (after !== null && (!Number.isSafeInteger(after) || after < 0)) {
    return res.status(400).json({ error: "Invalid receipt cursor" });
  }
  const [latest] = await sql`select coalesce(max(id),0) as latest_id,
    (select coalesce(jsonb_agg(jsonb_build_object('id',tm.id,'name',tm.name) order by tm.sort_order,tm.id),'[]'::jsonb)
      from registration_checkins rc join team_members tm on tm.id=rc.member_id and tm.team_id=rc.team_id
      where rc.team_id=${req.session.teamId}) as registrations,
    (select count(*)::int from team_members where team_id=${req.session.teamId}) as total_members
    from meal_logs where team_id=${req.session.teamId}`;
  const latestId=Number(latest.latest_id);
  const registration={teamId:req.session.teamId,members:latest.registrations || [],total:Number(latest.total_members || 0)};
  if (after === null || after >= latestId) return res.status(200).json({latestId,meals:[],registration});
  const rows = await sql`
    select ml.id, ms.label, ms.code, tm.name, ml.given_at
    from meal_logs ml join meal_slots ms on ms.id = ml.meal_slot_id
    join team_members tm on tm.id = ml.member_id
    where ml.team_id = ${req.session.teamId} and ml.id > ${after} order by ml.id desc limit 28
  `;
  res.status(200).json({ registration, latestId: Math.max(latestId,Number(rows[0]?.id || 0)),
    meals: after === null ? [] : rows.filter(row => row.id > after).reverse().map(row => ({
      id: row.id, slotCode: row.code, slotLabel: row.label, name: row.name, givenAt: row.given_at
    })) });
}

async function history(req, res) {
  const slotCode = searchParams(req).get("slotCode");
  const [slot] = await sql`select id, code, label from meal_slots where code = ${slotCode}`;
  if (!slot) return res.status(400).json({ error: "Unknown meal slot" });
  const rows = await sql`
    select t.id as team_id, t.team_code, t.seat_no, a.display_name as team_name,
      (select count(*)::int from team_members roster where roster.team_id=t.id) as total,
      tm.id as member_id, tm.name, to_jsonb(tm)->>'food_preference' as food_preference,
      ml.given_at, counter.display_name as counter_name
    from meal_logs ml join teams t on t.id = ml.team_id
    join accounts a on a.id = t.account_id
    join team_members tm on tm.id = ml.member_id
    left join accounts counter on counter.id = ml.given_by
    where ml.meal_slot_id = ${slot.id} order by ml.given_at desc, ml.id desc
  `;
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.team_id)) groups.set(row.team_id, {
      id: row.team_id, teamCode: row.team_code, teamName: row.team_name,
      seatNo: row.seat_no, total: row.total, members: []
    });
    groups.get(row.team_id).members.push({ id: row.member_id, name: row.name,
      foodPreference: row.food_preference, givenAt: row.given_at, counter: row.counter_name });
  }
  res.status(200).json({ slot: { code: slot.code, label: slot.label },
    teams: [...groups.values()].filter(team => team.total > 0 && team.members.length === team.total), served: rows.length, updatedAt: new Date().toISOString() });
}

async function staffSnapshot(req, res) {
  const revision = await staffRevision(sql,req,res);
  if (revision === null) return;
  const snapshot=await mealSnapshot(sql,searchParams(req).get("slotCode"));
  if (!snapshot.slot) return res.status(400).json({error:"Unknown meal slot"});
  res.status(200).json({...snapshot,updatedAt:new Date().toISOString(),revision});
}

function teamAndSlotToMembers(team, slot) {
  return sql`
    select tm.id, tm.name, tm.is_lead,
      to_jsonb(tm)->>'food_preference' as food_preference,
      exists(select 1 from registration_checkins rc where rc.member_id = tm.id and rc.team_id = tm.team_id) as registered,
      exists(
        select 1 from meal_logs ml
        where ml.member_id = tm.id and ml.meal_slot_id = ${slot.id}
      ) as already_given
    from team_members tm
    where tm.team_id = ${team.id}
    order by tm.sort_order asc, tm.id asc
  `;
}

function respondWithLookup(req, res, team, slot, mealSlotCode, members, dietary) {
  res.status(200).json({
    team: {
      id: team.id,
      teamCode: team.team_code,
      teamName: team.display_name,
      displayName: team.display_name,
      username: team.username,
      seatNo: team.seat_no,
      dietary: dietary || null,
    },
    scanProof: issueScanProof("meal", team.id, req.session.accountId, mealSlotCode),
    progress: { served: members.filter(m => m.already_given).length, total: members.length },
    slot: { code: mealSlotCode, label: slot.label },
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      isLead: m.is_lead,
      alreadyGiven: m.already_given,
      registered: m.registered,
      foodPreference: m.food_preference || null,
    })),
  });
}

/* scan result: the team's roster for the chosen slot, with whoever already
   has it logged flagged, so staff can't double-serve someone */
async function lookup(req, res) {
  const { qrPayload, mealSlotCode } = req.body || {};
  if (!qrPayload || !mealSlotCode) {
    res.status(400).json({ error: "qrPayload and mealSlotCode are required" });
    return;
  }

  const qrToken = parseQrToken(qrPayload);
  if (!qrToken) return res.status(400).json({ error: "Invalid Elevate QR code" });
  const teamRows = await sql`
    select t.id, t.team_code, t.seat_no, t.dietary, t.shortlisted, t.withdrawn, a.display_name, a.username
    from teams t
    join accounts a on a.id = t.account_id
    where t.qr_token = ${qrToken}
  `;
  const team = teamRows[0];
  if (!team) {
    res.status(404).json({ error: "No team matches this QR code" });
    return;
  }
  if (team.withdrawn) {
    res.status(403).json({ error: `Team ${team.team_code} has withdrawn` });
    return;
  }

  const checkinRows = await sql`
    select 1 from registration_checkins where team_id = ${team.id} limit 1
  `;
  if (!checkinRows[0]) {
    res.status(403).json({ error: `Team ${team.team_code} has not checked in at the registration desk yet` });
    return;
  }

  const slotRows = await sql`select id, label from meal_slots where code = ${mealSlotCode}`;
  const slot = slotRows[0];
  if (!slot) {
    res.status(400).json({ error: "Unknown meal slot" });
    return;
  }

  const members = await teamAndSlotToMembers(team, slot);
  respondWithLookup(req, res, team, slot, mealSlotCode, members, team.dietary);
}

/* fallback when a phone's camera can't scan (broken, bad light) — look the
   team up by the code printed on their own boarding pass instead */
async function lookupByCode(req, res) {
  const { teamCode, mealSlotCode } = req.body || {};
  if (!teamCode || !mealSlotCode) {
    res.status(400).json({ error: "teamCode and mealSlotCode are required" });
    return;
  }

  const teamRows = await sql`
    select t.id, t.team_code, t.seat_no, t.dietary, t.shortlisted, t.withdrawn, a.display_name, a.username
    from teams t
    join accounts a on a.id = t.account_id
    where upper(t.team_code) = upper(${teamCode.trim()})
  `;
  const team = teamRows[0];
  if (!team) {
    res.status(404).json({ error: "No team matches that code" });
    return;
  }
  if (team.withdrawn) {
    res.status(403).json({ error: `Team ${team.team_code} has withdrawn` });
    return;
  }

  const checkinRows = await sql`
    select 1 from registration_checkins where team_id = ${team.id} limit 1
  `;
  if (!checkinRows[0]) {
    res.status(403).json({ error: `Team ${team.team_code} has not checked in at the registration desk yet` });
    return;
  }

  const slotRows = await sql`select id, label from meal_slots where code = ${mealSlotCode}`;
  const slot = slotRows[0];
  if (!slot) {
    res.status(400).json({ error: "Unknown meal slot" });
    return;
  }

  const members = await teamAndSlotToMembers(team, slot);
  respondWithLookup(req, res, team, slot, mealSlotCode, members, team.dietary);
}

/* undo an accidentally logged meal for a single member */
async function undoMeal(req, res) {
  const { teamId, mealSlotCode, memberId } = req.body || {};
  if (!teamId || !mealSlotCode || !memberId) {
    res.status(400).json({ error: "teamId, mealSlotCode, and memberId are required" });
    return;
  }
  const slotRows = await sql`select id from meal_slots where code = ${mealSlotCode}`;
  const slot = slotRows[0];
  if (!slot) {
    res.status(400).json({ error: "Unknown meal slot" });
    return;
  }
  await sql`
    delete from meal_logs
    where team_id = ${teamId}
      and meal_slot_id = ${slot.id}
      and member_id = ${memberId}
  `;
  await logAction(req.session.accountId, "meal.undo", { teamId, memberId, mealSlotCode });
  res.status(200).json({ ok: true });
}

/* logs the meal slot as served for each selected member — safe to call
   more than once, the unique constraint just no-ops a repeat */
async function logMeal(req, res) {
  let input;
  try { input = parseMealRequest(req.body); }
  catch (error) { return res.status(400).json({ error: error.message }); }
  const { teamId, mealSlotCode, memberIds } = input;
  const scanId = verifyScanProof(req.body.scanProof, "meal", teamId, req.session.accountId, mealSlotCode);
  if (!scanId) return res.status(409).json({ error: "Scan the team QR again; this scan is missing or expired." });
  const [slot] = await sql`select id from meal_slots where code = ${mealSlotCode}`;
  if (!slot) return res.status(400).json({ error: "Unknown meal slot" });

  // Eligibility and insertion share one statement/snapshot. The unique
  // member/slot key resolves simultaneous confirmations at different counters.
  const [outcome] = await sql`
    with eligible as (
      select tm.id from team_members tm
      join teams t on t.id = tm.team_id
      join registration_checkins rc on rc.member_id = tm.id and rc.team_id = tm.team_id
      where tm.team_id = ${teamId} and tm.id = any(${memberIds}::int[])
        and t.withdrawn = false
    ), inserted as (
      insert into meal_logs (team_id, member_id, meal_slot_id, given_by, scan_id)
      select ${teamId}, id, ${slot.id}, ${req.session.accountId}, ${scanId} from eligible
      where (select count(*) from eligible) = ${memberIds.length}
      on conflict do nothing
      returning member_id
    )
    select (select count(*)::int from eligible) as eligible_count,
      coalesce((select json_agg(member_id) from inserted), '[]'::json) as inserted_ids,
      exists(select 1 from meal_logs where scan_id = ${scanId}) as scan_reused
  `;
  if (outcome.eligible_count !== memberIds.length) {
    return res.status(409).json({ error: "Every selected participant must belong to this team and be registered. Refresh the roster and try again." });
  }
  const insertedIds = outcome.inserted_ids;
  if (!insertedIds.length && outcome.scan_reused) return res.status(409).json({ error: "This scan has already been used. Scan the team QR again for the next participant." });
  await logAction(req.session.accountId, "meal.log", { teamId, mealSlotCode, count: insertedIds.length });
  res.status(200).json({ ok: true, logged: insertedIds.length, memberIds: insertedIds,
    alreadyServed: memberIds.length - insertedIds.length });
}

/* a team shows up with someone not on the roster — logged as an incident
   with a headcount/note rather than silently served or silently turned
   away */
async function logGuest(req, res) {
  const { teamId, mealSlotCode, note } = req.body || {};
  if (!teamId || !mealSlotCode || !note || !note.trim()) {
    res.status(400).json({ error: "teamId, mealSlotCode and a note are required" });
    return;
  }
  await createIncident({
    type: "guest",
    teamId,
    message: `${mealSlotCode}: ${note.trim()}`,
    createdBy: req.session.accountId,
    createdRole: req.session.role,
  });
  await logAction(req.session.accountId, "meal.log_guest", { teamId, mealSlotCode });
  res.status(200).json({ ok: true });
}

return handler;
}

export default requireRole(createMealHandler(), ["meal", "admin", "team"]);
