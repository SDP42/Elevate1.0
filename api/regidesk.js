import { sql } from "./_lib/db.js";
import { requireRole } from "./_lib/auth.js";
import { logAction } from "./_lib/audit.js";

const QR_PREFIX = "ELEVATE1:";

/* Registration desk (and admin) only: scan a team's boarding pass on
   arrival, then record per-member details — GitHub handle, government ID
   checked, bag checked, ideation kit (notebook, pen, folder) handed over,
   any note — one row per member, updatable (a team that shows up
   incomplete can be finished later without starting over).
   POST {action: "save", ...} saves one member's details; anything else
   (the default) is the lookup. */
async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const { action } = req.body || {};
  if (action === "save") return save(req, res);
  if (action === "lookup-by-code") return lookupByCode(req, res);
  return lookup(req, res);
}

async function membersFor(team) {
  return sql`
    select tm.id, tm.name, tm.is_lead,
      rc.github_id, rc.govt_id_checked, rc.bag_checked, rc.kit_checked, rc.notes
    from team_members tm
    left join registration_checkins rc on rc.member_id = tm.id
    where tm.team_id = ${team.id}
    order by tm.sort_order asc, tm.id asc
  `;
}

function respond(res, team, members) {
  res.status(200).json({
    team: { id: team.id, teamCode: team.team_code, seatNo: team.seat_no },
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      isLead: m.is_lead,
      githubId: m.github_id || "",
      govtIdChecked: m.govt_id_checked || false,
      bagChecked: m.bag_checked || false,
      kitChecked: m.kit_checked || false,
      notes: m.notes || "",
    })),
  });
}

async function lookup(req, res) {
  const { qrPayload } = req.body || {};
  if (!qrPayload) {
    res.status(400).json({ error: "qrPayload is required" });
    return;
  }
  const qrToken = qrPayload.startsWith(QR_PREFIX) ? qrPayload.slice(QR_PREFIX.length) : qrPayload;
  const teamRows = await sql`select id, team_code, seat_no from teams where qr_token = ${qrToken}`;
  const team = teamRows[0];
  if (!team) {
    res.status(404).json({ error: "No team matches this QR code" });
    return;
  }
  respond(res, team, await membersFor(team));
}

/* fallback when a phone's camera can't scan — look the team up by the
   code printed on their own boarding pass instead */
async function lookupByCode(req, res) {
  const { teamCode } = req.body || {};
  if (!teamCode) {
    res.status(400).json({ error: "teamCode is required" });
    return;
  }
  const teamRows = await sql`
    select id, team_code, seat_no from teams where upper(team_code) = upper(${teamCode.trim()})
  `;
  const team = teamRows[0];
  if (!team) {
    res.status(404).json({ error: "No team matches that code" });
    return;
  }
  respond(res, team, await membersFor(team));
}

/* one member's registration-desk details, upserted */
async function save(req, res) {
  const { memberId, teamId, githubId, govtIdChecked, bagChecked, kitChecked, notes } = req.body || {};
  if (!memberId || !teamId) {
    res.status(400).json({ error: "memberId and teamId are required" });
    return;
  }

  // the member must actually belong to the stated team — a tampered
  // request can't write against someone else's roster
  const memberRows = await sql`select id from team_members where id = ${memberId} and team_id = ${teamId}`;
  if (!memberRows[0]) {
    res.status(400).json({ error: "That member doesn't belong to that team" });
    return;
  }

  await sql`
    insert into registration_checkins (member_id, team_id, github_id, govt_id_checked, bag_checked, kit_checked, notes, checked_in_by)
    values (${memberId}, ${teamId}, ${githubId || null}, ${Boolean(govtIdChecked)}, ${Boolean(bagChecked)}, ${Boolean(kitChecked)}, ${notes || null}, ${req.session.accountId})
    on conflict (member_id) do update set
      github_id = excluded.github_id,
      govt_id_checked = excluded.govt_id_checked,
      bag_checked = excluded.bag_checked,
      kit_checked = excluded.kit_checked,
      notes = excluded.notes,
      checked_in_by = excluded.checked_in_by,
      checked_in_at = now()
  `;

  await logAction(req.session.accountId, "regidesk.save", { memberId, teamId });
  res.status(200).json({ ok: true });
}

export default requireRole(handler, ["regidesk", "admin"]);
