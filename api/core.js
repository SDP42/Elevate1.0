import { sql } from "./_lib/db.js";
import { requireRole } from "./_lib/auth.js";
import { logAction } from "./_lib/audit.js";
import { CRITERIA } from "../shared/criteria.js";

const QR_PREFIX = "ELEVATE1:";

/* Core (and admin) only: everything a mentor/judge needs shares this file
   — see api/auth.js for why. GET lists the teams this account is actually
   responsible for (every team, unless an admin has narrowed them down via
   core_assignments, minus any team this account has personally recused
   itself from), with their PS, Round 2 marks, latest Round 1 note, and
   mentoring slot time if one was set. POST's `action` field picks the
   write: submitting a mark (the default), a Round 1 note, toggling a
   recusal, or the two steps of a door check-in scan. */
async function handler(req, res) {
  if (req.method === "GET") return listTeams(req, res);
  if (req.method === "POST") {
    const { action } = req.body || {};
    if (action === "round1-note") return saveRound1Note(req, res);
    if (action === "checkin-lookup") return checkinLookup(req, res);
    if (action === "checkin-log") return checkinLog(req, res);
    if (action === "toggle-recuse") return toggleRecuse(req, res);
    return submitMark(req, res);
  }
  res.status(405).json({ error: "Method not allowed" });
}

async function listTeams(req, res) {
  const accountId = req.session.accountId;
  const isAdmin = req.session.role === "admin";

  // an admin, or a core account nobody has narrowed down, sees everyone
  let assignedIds = null;
  const slotTimes = new Map();
  if (!isAdmin) {
    const rows = await sql`select team_id, slot_time from core_assignments where core_account_id = ${accountId}`;
    if (rows.length > 0) assignedIds = rows.map((r) => r.team_id);
    for (const r of rows) if (r.slot_time) slotTimes.set(r.team_id, r.slot_time);
  }

  const recusedRows = isAdmin
    ? []
    : await sql`select team_id from core_recusals where core_account_id = ${accountId}`;
  const recusedIds = new Set(recusedRows.map((r) => r.team_id));

  const teams = await sql`
    select
      t.id, t.team_code, t.seat_no,
      m.score, m.criteria, m.feedback,
      p.code as ps_code, p.title as ps_title, p.description as ps_description,
      rn.note as round1_note
    from teams t
    left join marks m
      on m.team_id = t.id
      and m.round_id = (select id from mentoring_rounds where round_no = 2)
    left join team_ps_selection sel on sel.team_id = t.id
    left join ps_list p on p.id = sel.ps_id
    left join lateral (
      select note from round1_notes where team_id = t.id order by entered_at desc limit 1
    ) rn on true
    order by t.id asc
  `;

  const filtered = teams
    .filter((t) => (assignedIds ? assignedIds.includes(t.id) : true))
    .filter((t) => !recusedIds.has(t.id));

  res.status(200).json({
    criteria: CRITERIA,
    teams: filtered.map((t) => ({
      id: t.id,
      teamCode: t.team_code,
      seatNo: t.seat_no,
      score: t.score === null ? null : Number(t.score),
      criteria: t.criteria || null,
      feedback: t.feedback || "",
      psCode: t.ps_code,
      psTitle: t.ps_title,
      psDescription: t.ps_description || "",
      round1Note: t.round1_note || "",
      slotTime: slotTimes.get(t.id) || "",
    })),
  });
}

/* a core account excusing itself from one team (conflict of interest) —
   toggled by the mentor themselves, independent of admin's assignment
   narrowing, so recusing one team never flips "sees everyone" into "sees
   only this team" */
async function toggleRecuse(req, res) {
  if (req.session.role !== "core") {
    res.status(403).json({ error: "Only a core account can recuse itself" });
    return;
  }
  const { teamId } = req.body || {};
  if (!teamId) {
    res.status(400).json({ error: "teamId is required" });
    return;
  }
  const existing = await sql`
    select 1 from core_recusals where core_account_id = ${req.session.accountId} and team_id = ${teamId}
  `;
  if (existing[0]) {
    await sql`delete from core_recusals where core_account_id = ${req.session.accountId} and team_id = ${teamId}`;
  } else {
    await sql`insert into core_recusals (core_account_id, team_id) values (${req.session.accountId}, ${teamId})`;
  }
  await logAction(req.session.accountId, "core.toggle_recuse", { teamId, recused: !existing[0] });
  res.status(200).json({ ok: true, recused: !existing[0] });
}

/* Expects { teamId, criteria: { <key>: number, ... }, feedback? }. The
   total (score) is computed here, server-side, rather than trusted from
   the client, so it can never drift from the sum of what was entered. */
async function submitMark(req, res) {
  const { teamId, criteria, feedback } = req.body || {};
  if (!teamId || !criteria || typeof criteria !== "object") {
    res.status(400).json({ error: "teamId and a criteria score for each category are required" });
    return;
  }

  let total = 0;
  const clean = {};
  for (const c of CRITERIA) {
    const value = Number(criteria[c.key]);
    if (Number.isNaN(value) || value < 0 || value > c.max) {
      res.status(400).json({ error: `${c.label} must be a number between 0 and ${c.max}` });
      return;
    }
    clean[c.key] = value;
    total += value;
  }

  await sql`
    insert into marks (team_id, round_id, score, criteria, feedback, entered_by)
    select ${teamId}, id, ${total}, ${JSON.stringify(clean)}::jsonb, ${feedback || null}, ${req.session.accountId}
    from mentoring_rounds where round_no = 2
    on conflict (team_id, round_id) do update set
      score = excluded.score,
      criteria = excluded.criteria,
      feedback = excluded.feedback,
      entered_by = excluded.entered_by,
      entered_at = now()
  `;

  await logAction(req.session.accountId, "mark.submit", { teamId, score: total });
  res.status(200).json({ ok: true, score: total });
}

async function saveRound1Note(req, res) {
  const { teamId, note } = req.body || {};
  if (!teamId || !note || !note.trim()) {
    res.status(400).json({ error: "teamId and a note are required" });
    return;
  }

  await sql`
    insert into round1_notes (team_id, note, entered_by)
    values (${teamId}, ${note.trim()}, ${req.session.accountId})
  `;
  await logAction(req.session.accountId, "round1_note.add", { teamId });
  res.status(200).json({ ok: true });
}

/* door check-in scan: who's on this team and whether they're already in */
async function checkinLookup(req, res) {
  const { qrPayload } = req.body || {};
  if (!qrPayload) {
    res.status(400).json({ error: "qrPayload is required" });
    return;
  }
  const trimmed = qrPayload.trim();
  const qrToken = trimmed.startsWith(QR_PREFIX) ? trimmed.slice(QR_PREFIX.length) : trimmed;

  const teamRows = await sql`select id, team_code, seat_no from teams where qr_token = ${qrToken}`;
  const team = teamRows[0];
  if (!team) {
    res.status(404).json({ error: `No team matches this QR code (scanned: "${trimmed.slice(0, 60)}")` });
    return;
  }

  const members = await sql`
    select tm.id, tm.name, tm.is_lead,
      exists(select 1 from event_checkins ec where ec.member_id = tm.id) as already_in
    from team_members tm
    where tm.team_id = ${team.id}
    order by tm.sort_order asc, tm.id asc
  `;

  res.status(200).json({
    team: { id: team.id, teamCode: team.team_code, seatNo: team.seat_no },
    members: members.map((m) => ({ id: m.id, name: m.name, isLead: m.is_lead, alreadyIn: m.already_in })),
  });
}

async function checkinLog(req, res) {
  const { teamId, memberIds } = req.body || {};
  if (!teamId || !Array.isArray(memberIds) || memberIds.length === 0) {
    res.status(400).json({ error: "teamId and at least one memberId are required" });
    return;
  }

  const validMembers = await sql`
    select id from team_members where team_id = ${teamId} and id = any(${memberIds}::int[])
  `;
  const validIds = new Set(validMembers.map((m) => m.id));

  for (const memberId of memberIds) {
    if (!validIds.has(memberId)) continue;
    await sql`
      insert into event_checkins (team_id, member_id, checked_in_by)
      values (${teamId}, ${memberId}, ${req.session.accountId})
      on conflict (member_id) do nothing
    `;
  }

  await logAction(req.session.accountId, "checkin.log", { teamId, count: validIds.size });
  res.status(200).json({ ok: true, checkedIn: validIds.size });
}

export default requireRole(handler, ["core", "admin"]);
