import { sql } from "./_lib/db.js";
import { requireRole } from "./_lib/auth.js";
import { logAction } from "./_lib/audit.js";
import { createIncident } from "./_lib/incidents.js";

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
      rc.github_id, rc.govt_id_checked, rc.bag_checked, rc.kit_checked,
      rc.medical_note, rc.late_arrival, rc.notes
    from team_members tm
    left join registration_checkins rc on rc.member_id = tm.id
    where tm.team_id = ${team.id}
    order by tm.sort_order asc, tm.id asc
  `;
}

function respond(res, team, members) {
  res.status(200).json({
    team: {
      id: team.id,
      teamCode: team.team_code,
      teamName: team.display_name,
      displayName: team.display_name,
      username: team.username,
      seatNo: team.seat_no,
    },
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      isLead: m.is_lead,
      githubId: m.github_id || "",
      govtIdChecked: m.govt_id_checked || false,
      bagChecked: m.bag_checked || false,
      kitChecked: m.kit_checked || false,
      medicalNote: m.medical_note || "",
      lateArrival: m.late_arrival || false,
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
  const trimmed = qrPayload.trim();
  const qrToken = trimmed.startsWith(QR_PREFIX) ? trimmed.slice(QR_PREFIX.length) : trimmed;
  const teamRows = await sql`
    select t.id, t.team_code, t.seat_no, t.shortlisted, t.withdrawn, a.display_name, a.username
    from teams t
    join accounts a on a.id = t.account_id
    where t.qr_token = ${qrToken}
  `;
  const team = teamRows[0];
  if (!team) {
    // scanned payload included (truncated) so staff can tell at a glance
    // whether this is a stale/unrelated QR code rather than a real bug
    res.status(404).json({ error: `No team matches this QR code (scanned: "${trimmed.slice(0, 60)}")` });
    return;
  }
  if (team.withdrawn) {
    res.status(403).json({ error: `Team ${team.team_code} has withdrawn` });
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
    select t.id, t.team_code, t.seat_no, t.shortlisted, t.withdrawn, a.display_name, a.username
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
  respond(res, team, await membersFor(team));
}

/* one member's registration-desk details, upserted */
async function save(req, res) {
  const { memberId, teamId, githubId, govtIdChecked, bagChecked, kitChecked, medicalNote, lateArrival, notes } =
    req.body || {};
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

  const wasLateRows = await sql`select late_arrival from registration_checkins where member_id = ${memberId}`;
  const wasLate = wasLateRows[0]?.late_arrival || false;

  await sql`
    insert into registration_checkins
      (member_id, team_id, github_id, govt_id_checked, bag_checked, kit_checked, medical_note, late_arrival, notes, checked_in_by)
    values (
      ${memberId}, ${teamId}, ${githubId || null}, ${Boolean(govtIdChecked)}, ${Boolean(bagChecked)},
      ${Boolean(kitChecked)}, ${medicalNote || null}, ${Boolean(lateArrival)}, ${notes || null}, ${req.session.accountId}
    )
    on conflict (member_id) do update set
      github_id = excluded.github_id,
      govt_id_checked = excluded.govt_id_checked,
      bag_checked = excluded.bag_checked,
      kit_checked = excluded.kit_checked,
      medical_note = excluded.medical_note,
      late_arrival = excluded.late_arrival,
      notes = excluded.notes,
      checked_in_by = excluded.checked_in_by,
      checked_in_at = now()
  `;

  if (Boolean(lateArrival) && !wasLate) {
    await createIncident({
      type: "late_arrival",
      teamId,
      message: `Late arrival at registration: member ${memberId}`,
      createdBy: req.session.accountId,
      createdRole: req.session.role,
    });
  }

  await logAction(req.session.accountId, "regidesk.save", { memberId, teamId });
  res.status(200).json({ ok: true });
}

export default requireRole(handler, ["regidesk", "admin"]);
