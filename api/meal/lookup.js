import { sql } from "../_lib/db.js";
import { requireRole } from "../_lib/auth.js";

const QR_PREFIX = "ELEVATE1:";

/* Meal (and admin) only: scan result. Takes the raw QR payload and the
   meal slot the counter is currently serving, returns the team's roster
   with whoever already has that slot logged flagged, so staff can't
   double-serve someone who already came through. */
async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

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

export default requireRole(handler, ["meal", "admin"]);
