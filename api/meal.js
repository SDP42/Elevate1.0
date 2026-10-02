import { sql } from "./_lib/db.js";
import { requireRole } from "./_lib/auth.js";
import { logAction } from "./_lib/audit.js";
import { createIncident } from "./_lib/incidents.js";

const QR_PREFIX = "ELEVATE1:";

/* Meal (and admin) only: the scan lookup, the manual-code fallback, the
   confirm-and-log step, and the running tally all share this file — see
   api/auth.js for why. GET is the tally; POST's `action` picks the write
   ("log" logs, "lookup-by-code" looks up by typed team code instead of a
   camera scan, "flag-low-stock"/"log-guest" raise an incident for admin,
   anything else is the normal QR lookup). */
async function handler(req, res) {
  if (req.method === "GET") return tally(req, res);
  if (req.method === "POST") {
    const { action } = req.body || {};
    if (action === "log") return logMeal(req, res);
    if (action === "lookup-by-code") return lookupByCode(req, res);
    if (action === "flag-low-stock") return flagLowStock(req, res);
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

function teamAndSlotToMembers(team, slot) {
  return sql`
    select tm.id, tm.name, tm.is_lead,
      exists(
        select 1 from meal_logs ml
        where ml.member_id = tm.id and ml.meal_slot_id = ${slot.id}
      ) as already_given
    from team_members tm
    where tm.team_id = ${team.id}
    order by tm.sort_order asc, tm.id asc
  `;
}

function respondWithLookup(res, team, slot, mealSlotCode, members, dietary) {
  res.status(200).json({
    team: { id: team.id, teamCode: team.team_code, seatNo: team.seat_no, dietary: dietary || null },
    slot: { code: mealSlotCode, label: slot.label },
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      isLead: m.is_lead,
      alreadyGiven: m.already_given,
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

  const trimmed = qrPayload.trim();
  const qrToken = trimmed.startsWith(QR_PREFIX) ? trimmed.slice(QR_PREFIX.length) : trimmed;
  const teamRows = await sql`select id, team_code, seat_no, dietary from teams where qr_token = ${qrToken}`;
  const team = teamRows[0];
  if (!team) {
    res.status(404).json({ error: `No team matches this QR code (scanned: "${trimmed.slice(0, 60)}")` });
    return;
  }

  const slotRows = await sql`select id, label from meal_slots where code = ${mealSlotCode}`;
  const slot = slotRows[0];
  if (!slot) {
    res.status(400).json({ error: "Unknown meal slot" });
    return;
  }

  const members = await teamAndSlotToMembers(team, slot);
  respondWithLookup(res, team, slot, mealSlotCode, members, team.dietary);
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
    select id, team_code, seat_no, dietary from teams where upper(team_code) = upper(${teamCode.trim()})
  `;
  const team = teamRows[0];
  if (!team) {
    res.status(404).json({ error: "No team matches that code" });
    return;
  }

  const slotRows = await sql`select id, label from meal_slots where code = ${mealSlotCode}`;
  const slot = slotRows[0];
  if (!slot) {
    res.status(400).json({ error: "Unknown meal slot" });
    return;
  }

  const members = await teamAndSlotToMembers(team, slot);
  respondWithLookup(res, team, slot, mealSlotCode, members, team.dietary);
}

/* logs the meal slot as served for each selected member — safe to call
   more than once, the unique constraint just no-ops a repeat */
async function logMeal(req, res) {
  const { teamId, mealSlotCode, memberIds } = req.body || {};
  if (!teamId || !mealSlotCode || !Array.isArray(memberIds) || memberIds.length === 0) {
    res.status(400).json({ error: "teamId, mealSlotCode and at least one memberId are required" });
    return;
  }

  const slotRows = await sql`select id from meal_slots where code = ${mealSlotCode}`;
  const slot = slotRows[0];
  if (!slot) {
    res.status(400).json({ error: "Unknown meal slot" });
    return;
  }

  // every member must actually belong to this team — a stray id from a
  // tampered request can't log a meal against someone else's roster
  const validMembers = await sql`
    select id from team_members where team_id = ${teamId} and id = any(${memberIds}::int[])
  `;
  const validIds = new Set(validMembers.map((m) => m.id));

  for (const memberId of memberIds) {
    if (!validIds.has(memberId)) continue;
    await sql`
      insert into meal_logs (team_id, member_id, meal_slot_id, given_by)
      values (${teamId}, ${memberId}, ${slot.id}, ${req.session.accountId})
      on conflict (member_id, meal_slot_id) do nothing
    `;
  }

  await logAction(req.session.accountId, "meal.log", { teamId, mealSlotCode, count: validIds.size });
  res.status(200).json({ ok: true, logged: validIds.size });
}

/* "we're almost out of X" — a visible flag for admin/organisers, not a
   passive count they'd have to keep refreshing to notice */
async function flagLowStock(req, res) {
  const { mealSlotCode, note } = req.body || {};
  if (!mealSlotCode || !note || !note.trim()) {
    res.status(400).json({ error: "mealSlotCode and a note are required" });
    return;
  }
  await createIncident({
    type: "low_stock",
    message: `${mealSlotCode}: ${note.trim()}`,
    createdBy: req.session.accountId,
    createdRole: req.session.role,
  });
  await logAction(req.session.accountId, "meal.flag_low_stock", { mealSlotCode });
  res.status(200).json({ ok: true });
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

export default requireRole(handler, ["meal", "admin"]);
