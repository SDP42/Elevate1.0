import { sql as defaultSql } from "./_lib/db.js";
import { requireRole } from "./_lib/auth.js";
import { logAction as defaultLogAction } from "./_lib/audit.js";
import { createIncident as defaultCreateIncident } from "./_lib/incidents.js";

import { issueScanProof, verifyScanProof } from "./_lib/scan-proof.js";
import { parseQrToken } from "../shared/meal.js";

/* Registration desk (and admin) only: scan a team's boarding pass on
   arrival, then record per-member details — GitHub handle, government ID
   checked, bag checked, ideation kit (notebook, pen, folder) handed over,
   any note — one row per member, updatable (a team that shows up
   incomplete can be finished later without starting over).
   POST {action: "save", ...} saves one member's details; anything else
   (the default) is the lookup. */
export function createRegistrationHandler({ sql = defaultSql, logAction = defaultLogAction, createIncident = defaultCreateIncident } = {}) {
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
    select tm.id, tm.name, tm.is_lead, rc.member_id is not null as registered,
      to_jsonb(tm)->>'food_preference' as food_preference,
      rc.github_id, rc.govt_id_checked, rc.bag_checked, rc.kit_checked,
      rc.medical_note, rc.late_arrival, rc.notes
    from team_members tm
    left join registration_checkins rc on rc.member_id = tm.id
    where tm.team_id = ${team.id}
    order by tm.sort_order asc, tm.id asc
  `;
}

function respond(req, res, team, members) {
  res.status(200).json({
    team: {
      id: team.id,
      teamCode: team.team_code,
      teamName: team.display_name,
      displayName: team.display_name,
      username: team.username,
      seatNo: team.seat_no,
    },
    scanProof: issueScanProof("registration", team.id, req.session.accountId),
    progress: { registered: members.filter(m => m.registered).length, total: members.length },
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      isLead: m.is_lead,
      registered: m.registered,
      foodPreference: m.food_preference,
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
  const qrToken = parseQrToken(qrPayload);
  if (!qrToken) return res.status(400).json({ error: "Invalid Elevate QR code" });
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
    res.status(404).json({ error: "No team matches this QR code" });
    return;
  }
  if (team.withdrawn) {
    res.status(403).json({ error: `Team ${team.team_code} has withdrawn` });
    return;
  }
  respond(req, res, team, await membersFor(team));
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
  respond(req, res, team, await membersFor(team));
}

/* one member's registration-desk details, upserted */
async function save(req, res) {
  const { memberId, teamId, githubId, govtIdChecked, bagChecked, kitChecked, medicalNote, lateArrival, notes } =
    req.body || {};
  if (!Number.isInteger(memberId) || memberId < 1 || !Number.isInteger(teamId) || teamId < 1) {
    res.status(400).json({ error: "memberId and teamId are required" });
    return;
  }

  const scanId = verifyScanProof(req.body.scanProof, "registration", teamId, req.session.accountId);
  if (!scanId) return res.status(409).json({ error: "Scan the team QR again; this scan is missing or expired." });

  // the member must actually belong to the stated team — a tampered
  // request can't write against someone else's roster
  const memberRows = await sql`select id from team_members where id = ${memberId} and team_id = ${teamId}`;
  if (!memberRows[0]) {
    res.status(400).json({ error: "That member doesn't belong to that team" });
    return;
  }

  const wasLateRows = await sql`select late_arrival from registration_checkins where member_id = ${memberId}`;
  const wasLate = wasLateRows[0]?.late_arrival || false;

  let registeredRows;
  try { registeredRows = await sql`
    insert into registration_checkins
      (member_id, team_id, github_id, govt_id_checked, bag_checked, kit_checked, medical_note, late_arrival, notes, checked_in_by, scan_id)
    select
      ${memberId}, ${teamId}, ${githubId || null}, ${Boolean(govtIdChecked)}, ${Boolean(bagChecked)},
      ${Boolean(kitChecked)}, ${medicalNote || null}, ${Boolean(lateArrival)}, ${notes || null}, ${req.session.accountId}, ${scanId}
    from teams t where t.id = ${teamId} and t.withdrawn = false
      and not exists(select 1 from registration_checkins rc where rc.scan_id = ${scanId} and rc.member_id <> ${memberId})
    on conflict (member_id) do nothing
    returning member_id
  `; } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "This scan has already been used. Scan the team QR again." });
    throw error;
  }
  if (!registeredRows.length) return res.status(409).json({ error: "This participant is already registered, the scan was used, or the team has withdrawn. Scan again." });

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
  const [progress] = await sql`select (select count(*)::int from registration_checkins where team_id=${teamId}) as registered, (select count(*)::int from team_members where team_id=${teamId}) as total`;
  res.status(200).json({ ok: true, progress });
}

return handler;
}

export default requireRole(createRegistrationHandler(), ["regidesk", "admin"]);
