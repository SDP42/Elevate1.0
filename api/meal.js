import { sql } from "./_lib/db.js";
import { requireRole } from "./_lib/auth.js";

const QR_PREFIX = "ELEVATE1:";

/* Meal (and admin) only: both the scan lookup and the confirm-and-log step
   share this file — see api/auth.js for why. POST {action: "log", ...}
   logs; anything else (the default) is a lookup. */
async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const { action } = req.body || {};
  if (action === "log") return logMeal(req, res);
  return lookup(req, res);
}

/* scan result: the team's roster for the chosen slot, with whoever already
   has it logged flagged, so staff can't double-serve someone */
async function lookup(req, res) {
  const { qrPayload, mealSlotCode } = req.body || {};
  if (!qrPayload || !mealSlotCode) {
    res.status(400).json({ error: "qrPayload and mealSlotCode are required" });
    return;
  }

  const qrToken = qrPayload.startsWith(QR_PREFIX) ? qrPayload.slice(QR_PREFIX.length) : qrPayload;

  const teamRows = await sql`
    select t.id, t.team_code, t.seat_no
    from teams t
    where t.qr_token = ${qrToken}
  `;
  const team = teamRows[0];
  if (!team) {
    res.status(404).json({ error: "No team matches this QR code" });
    return;
  }

  const slotRows = await sql`select id, label from meal_slots where code = ${mealSlotCode}`;
  const slot = slotRows[0];
  if (!slot) {
    res.status(400).json({ error: "Unknown meal slot" });
    return;
  }

  const members = await sql`
    select tm.id, tm.name, tm.is_lead,
      exists(
        select 1 from meal_logs ml
        where ml.member_id = tm.id and ml.meal_slot_id = ${slot.id}
      ) as already_given
    from team_members tm
    where tm.team_id = ${team.id}
    order by tm.sort_order asc, tm.id asc
  `;

  res.status(200).json({
    team: { id: team.id, teamCode: team.team_code, seatNo: team.seat_no },
    slot: { code: mealSlotCode, label: slot.label },
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      isLead: m.is_lead,
      alreadyGiven: m.already_given,
    })),
  });
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

  res.status(200).json({ ok: true, logged: validIds.size });
}

export default requireRole(handler, ["meal", "admin"]);
