import { sql } from "../_lib/db.js";
import { requireRole } from "../_lib/auth.js";

/* Meal (and admin) only: logs the meal slot as served for each selected
   member. Safe to call more than once for the same member/slot — the
   unique constraint on meal_logs just no-ops the repeat. */
async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

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
