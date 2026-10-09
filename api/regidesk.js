import { staffRevision, teamDirectory } from "./_lib/staff-sync.js";
import { sql as defaultSql } from "./_lib/db.js";
import { requireRole } from "./_lib/auth.js";
import { logAction as defaultLogAction } from "./_lib/audit.js";
import { createIncident as defaultCreateIncident } from "./_lib/incidents.js";

import { issueScanProof, verifyScanProof } from "./_lib/scan-proof.js";
import { parseQrToken } from "../shared/meal.js";

/* Registration desk and admin: look up a team using its shared QR or code,
   then check in the selected members together after their individual checks.
   The legacy single-member action uses the same atomic save path. */
export function createRegistrationHandler({ sql = defaultSql, logAction = defaultLogAction, createIncident = defaultCreateIncident } = {}) {
async function handler(req, res) {
  if (req.method === "GET") {
    const revision=await staffRevision(sql,req,res);
    if(revision === null)return;
    return res.status(200).json({revision,directory:await teamDirectory(sql),updatedAt:new Date().toISOString()});
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const { action } = req.body || {};
  if (action === "save" || action === "save-members") return save(req, res);
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

/* A selection is committed atomically. Lock the team so two counters cannot
   partially register overlapping selections. A proof may be consumed once. */
async function save(req, res) {
  const { teamId } = req.body || {};
  const members = req.body.members || [{ ...req.body, id: req.body.memberId }];
  if (!Number.isInteger(teamId) || teamId < 1 || !Array.isArray(members) || !members.length || members.length > 4 ||
      members.some(m => !m || !Number.isInteger(m.id) || m.id < 1 ||
        ['govtIdChecked','bagChecked','kitChecked','lateArrival'].some(key => m[key] !== undefined && typeof m[key] !== 'boolean')) ||
      new Set(members.map(m => m.id)).size !== members.length) {
    return res.status(400).json({ error: "Select valid participants from this team." });
  }
  const scanId = verifyScanProof(req.body.scanProof, "registration", teamId, req.session.accountId);
  if (!scanId) return res.status(409).json({ error: "Scan the team QR again; this scan is missing or expired." });
  const payload = JSON.stringify(members.map(m => ({id:m.id,govtIdChecked:!!m.govtIdChecked,bagChecked:!!m.bagChecked,kitChecked:!!m.kitChecked,lateArrival:!!m.lateArrival})));
  const results = await sql.transaction(tx => [
    tx`select id from teams where id=${teamId} for update`,
    tx`with selected as (
      select *, row_number() over (order by id) as position from jsonb_to_recordset(${payload}::jsonb)
      as m(id int, "govtIdChecked" boolean, "bagChecked" boolean, "kitChecked" boolean, "lateArrival" boolean)
    ), eligible as (
      select s.* from selected s join team_members tm on tm.id=s.id and tm.team_id=${teamId}
      join teams t on t.id=tm.team_id and t.withdrawn=false
    )
    insert into registration_checkins(member_id,team_id,govt_id_checked,bag_checked,kit_checked,late_arrival,checked_in_by,scan_id)
    select id,${teamId},"govtIdChecked","bagChecked","kitChecked","lateArrival",${req.session.accountId},
      case when position=1 then ${scanId} else ${scanId} || ':' || id::text end
    from eligible where (select count(*) from eligible)=${members.length}
      and not exists(select 1 from registration_checkins where scan_id=${scanId})
      and not exists(select 1 from registration_checkins rc join selected s on rc.member_id=s.id)
    returning member_id`,
    tx`select (select count(*)::int from registration_checkins where team_id=${teamId}) registered,
      (select count(*)::int from team_members where team_id=${teamId}) total`
  ], {isolationLevel:'ReadCommitted'});
  const registered = results[1];
  if (!registered.length) return res.status(409).json({ error: "Selection was not saved: a participant is already registered, the team has withdrawn, or this scan was used. Look up the team again." });
  for (const member of members) {
    if (member.lateArrival) await createIncident({type:'late_arrival',teamId,message:`Late arrival at registration: member ${member.id}`,createdBy:req.session.accountId,createdRole:req.session.role});
  }
  await logAction(req.session.accountId, 'regidesk.save', {teamId,memberIds:registered.map(m=>m.member_id)});
  return res.status(200).json({ok:true,memberIds:registered.map(m=>m.member_id),progress:results[2][0]});
}

return handler;
}

export default requireRole(createRegistrationHandler(), ["regidesk", "admin"]);
