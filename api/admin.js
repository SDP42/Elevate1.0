import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { sql } from "./_lib/db.js";
import { requireRole } from "./_lib/auth.js";
import { searchParams } from "./_lib/http.js";
import { logAction } from "./_lib/audit.js";

/* Every admin-only read and write in one function (see api/auth.js for why
   — the Hobby plan's 12-function cap). GET ?resource=... picks the read;
   POST {action: ...} picks the write. */
async function handler(req, res) {
  if (req.method === "GET") {
    const resource = searchParams(req).get("resource") || "teams";
    if (resource === "accounts") return getAccounts(req, res);
    if (resource === "meals") return getMeals(req, res);
    if (resource === "audit") return getAudit(req, res);
    if (resource === "announcements") return getAnnouncements(req, res);
    if (resource === "assignments") return getAssignments(req, res);
    if (resource === "export") return exportCsv(req, res);
    return getTeams(req, res);
  }

  if (req.method === "POST") {
    const { action } = req.body || {};
    if (action === "save-ps") return savePs(req, res);
    if (action === "save-team-members") return saveTeamMembers(req, res);
    if (action === "set-shortlist") return setShortlist(req, res);
    if (action === "save-team-notes") return saveTeamNotes(req, res);
    if (action === "bulk-import") return bulkImport(req, res);
    if (action === "reset-password") return resetPassword(req, res);
    if (action === "save-announcement") return saveAnnouncement(req, res);
    if (action === "save-assignment") return saveAssignment(req, res);
    res.status(400).json({ error: "Unknown action" });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}

/* every team, its seat, and its member roster — the in-app view of the
   database the admin account is meant to have */
async function getTeams(req, res) {
  const teams = await sql`
    select t.id, t.team_code, t.seat_no, t.dietary, t.shortlisted,
      t.submission_url, t.submission_note, t.submitted_at,
      a.display_name, a.username
    from teams t
    join accounts a on a.id = t.account_id
    order by t.id asc
  `;

  const members = await sql`
    select team_id, id, name, is_lead
    from team_members
    order by team_id asc, sort_order asc, id asc
  `;

  const byTeam = new Map();
  for (const m of members) {
    if (!byTeam.has(m.team_id)) byTeam.set(m.team_id, []);
    byTeam.get(m.team_id).push({ id: m.id, name: m.name, isLead: m.is_lead });
  }

  res.status(200).json({
    teams: teams.map((t) => ({
      id: t.id,
      teamCode: t.team_code,
      seatNo: t.seat_no,
      dietary: t.dietary,
      shortlisted: t.shortlisted,
      submissionUrl: t.submission_url,
      submissionNote: t.submission_note,
      submittedAt: t.submitted_at,
      displayName: t.display_name,
      username: t.username,
      members: byTeam.get(t.id) || [],
    })),
  });
}

/* the staff roster (core, meal, admin) */
async function getAccounts(req, res) {
  const accounts = await sql`
    select id, username, role, display_name, created_at
    from accounts
    where role != 'team'
    order by role asc, username asc
  `;
  res.status(200).json({ accounts });
}

/* how many members have been served at each meal slot so far */
async function getMeals(req, res) {
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

/* the most recent actions — settles "who did what" disputes on the day */
async function getAudit(req, res) {
  const rows = await sql`
    select l.id, l.action, l.detail, l.created_at, a.username, a.role
    from audit_log l
    left join accounts a on a.id = l.actor_account_id
    order by l.created_at desc
    limit 200
  `;
  res.status(200).json({
    entries: rows.map((r) => ({
      id: r.id,
      action: r.action,
      detail: r.detail,
      createdAt: r.created_at,
      username: r.username,
      role: r.role,
    })),
  });
}

async function getAnnouncements(req, res) {
  const rows = await sql`select id, message, active, sort_order from announcements order by sort_order asc, id asc`;
  res.status(200).json({
    announcements: rows.map((r) => ({ id: r.id, message: r.message, active: r.active, sortOrder: r.sort_order })),
  });
}

async function getAssignments(req, res) {
  const cores = await sql`select id, username, display_name from accounts where role = 'core' order by username`;
  const assignments = await sql`select core_account_id, team_id from core_assignments`;
  const byCore = new Map();
  for (const a of assignments) {
    if (!byCore.has(a.core_account_id)) byCore.set(a.core_account_id, []);
    byCore.get(a.core_account_id).push(a.team_id);
  }
  res.status(200).json({
    cores: cores.map((c) => ({
      id: c.id,
      username: c.username,
      displayName: c.display_name,
      teamIds: byCore.get(c.id) || [],
    })),
  });
}

/* a plain CSV backup of whichever table is asked for */
async function exportCsv(req, res) {
  const type = searchParams(req).get("type") || "teams";

  const toCsv = (headers, rows) => {
    const esc = (v) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [headers.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  };

  let body;
  let filename;

  if (type === "marks") {
    const rows = await sql`
      select t.team_code, m.score, m.criteria, m.feedback
      from teams t
      left join marks m on m.team_id = t.id and m.round_id = (select id from mentoring_rounds where round_no = 2)
      order by t.id asc
    `;
    body = toCsv(
      ["team", "score", "criteria", "feedback"],
      rows.map((r) => [r.team_code, r.score, r.criteria ? JSON.stringify(r.criteria) : "", r.feedback])
    );
    filename = "elevate-marks.csv";
  } else if (type === "meals") {
    const rows = await sql`
      select t.team_code, tm.name, ms.label, ms.day_no, ml.given_at
      from meal_logs ml
      join team_members tm on tm.id = ml.member_id
      join teams t on t.id = ml.team_id
      join meal_slots ms on ms.id = ml.meal_slot_id
      order by ml.given_at asc
    `;
    body = toCsv(
      ["team", "member", "slot", "day", "given_at"],
      rows.map((r) => [r.team_code, r.name, r.label, r.day_no, r.given_at])
    );
    filename = "elevate-meals.csv";
  } else {
    const rows = await sql`
      select t.team_code, t.seat_no, t.shortlisted, t.dietary, a.username,
        string_agg(tm.name, '; ' order by tm.sort_order) as members
      from teams t
      join accounts a on a.id = t.account_id
      left join team_members tm on tm.team_id = t.id
      group by t.id, a.username
      order by t.id asc
    `;
    body = toCsv(
      ["team", "seat", "shortlisted", "dietary", "username", "members"],
      rows.map((r) => [r.team_code, r.seat_no, r.shortlisted, r.dietary, r.username, r.members])
    );
    filename = "elevate-teams.csv";
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(body);
}

/* create a problem statement, or update one that already exists (matched
   by its code) */
async function savePs(req, res) {
  const { code, title, description, capacity, revealed, sortOrder } = req.body || {};
  if (!code || !title) {
    res.status(400).json({ error: "code and title are required" });
    return;
  }

  await sql`
    insert into ps_list (code, title, description, capacity, revealed, sort_order)
    values (
      ${code.trim()},
      ${title.trim()},
      ${description || null},
      ${capacity === "" || capacity == null ? null : Number(capacity)},
      ${Boolean(revealed)},
      ${sortOrder ?? 0}
    )
    on conflict (code) do update set
      title = excluded.title,
      description = excluded.description,
      capacity = excluded.capacity,
      revealed = excluded.revealed,
      sort_order = excluded.sort_order
  `;

  await logAction(req.session.accountId, "ps.save", { code });
  res.status(200).json({ ok: true });
}

/* replace a team's roster wholesale — simplest correct way to swap the
   T1M1-style placeholders for real names */
async function saveTeamMembers(req, res) {
  const { teamId, members } = req.body || {};
  const names = (members || []).map((n) => String(n).trim()).filter(Boolean);

  if (!teamId || names.length < 2 || names.length > 4) {
    res.status(400).json({ error: "teamId and 2 to 4 member names are required" });
    return;
  }

  await sql`delete from team_members where team_id = ${teamId}`;
  for (let i = 0; i < names.length; i += 1) {
    await sql`
      insert into team_members (team_id, name, is_lead, sort_order)
      values (${teamId}, ${names[i]}, ${i === 0}, ${i + 1})
    `;
  }

  await logAction(req.session.accountId, "roster.save", { teamId });
  res.status(200).json({ ok: true });
}

/* mark which teams are the official Round 2 shortlist */
async function setShortlist(req, res) {
  const { teamId, shortlisted } = req.body || {};
  if (!teamId) {
    res.status(400).json({ error: "teamId is required" });
    return;
  }
  await sql`update teams set shortlisted = ${Boolean(shortlisted)} where id = ${teamId}`;
  await logAction(req.session.accountId, "shortlist.set", { teamId, shortlisted: Boolean(shortlisted) });
  res.status(200).json({ ok: true });
}

/* dietary note against a team — shown to meal counters at scan time */
async function saveTeamNotes(req, res) {
  const { teamId, dietary } = req.body || {};
  if (!teamId) {
    res.status(400).json({ error: "teamId is required" });
    return;
  }
  await sql`update teams set dietary = ${dietary || null} where id = ${teamId}`;
  await logAction(req.session.accountId, "team_notes.save", { teamId });
  res.status(200).json({ ok: true });
}

/* paste a CSV export (team_code,name1,name2,name3,name4) and populate every
   roster in one go instead of editing team-by-team */
async function bulkImport(req, res) {
  const { csvText } = req.body || {};
  if (!csvText || !csvText.trim()) {
    res.status(400).json({ error: "csvText is required" });
    return;
  }

  const lines = csvText.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  const results = [];

  for (const line of lines) {
    const cols = line.split(",").map((c) => c.trim());
    const [teamCode, ...names] = cols;
    const cleanNames = names.filter(Boolean).slice(0, 4);

    if (!teamCode || cleanNames.length < 2) {
      results.push({ teamCode: teamCode || "(blank)", ok: false, error: "needs a team code and 2-4 names" });
      continue;
    }

    const teamRows = await sql`select id from teams where upper(team_code) = upper(${teamCode})`;
    const team = teamRows[0];
    if (!team) {
      results.push({ teamCode, ok: false, error: "no team with that code" });
      continue;
    }

    await sql`delete from team_members where team_id = ${team.id}`;
    for (let i = 0; i < cleanNames.length; i += 1) {
      await sql`
        insert into team_members (team_id, name, is_lead, sort_order)
        values (${team.id}, ${cleanNames[i]}, ${i === 0}, ${i + 1})
      `;
    }
    results.push({ teamCode, ok: true });
  }

  await logAction(req.session.accountId, "roster.bulk_import", { rows: results.length });
  res.status(200).json({ results });
}

function randomPassword() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(crypto.randomFillSync(new Uint8Array(10)))
    .map((b) => alphabet[b % alphabet.length])
    .join("");
}

/* regenerate a password for one account — for when someone loses their
   login on event day. Returned once, in this response only; never stored
   or retrievable again afterwards. */
async function resetPassword(req, res) {
  const { accountId } = req.body || {};
  if (!accountId) {
    res.status(400).json({ error: "accountId is required" });
    return;
  }
  const password = randomPassword();
  const hash = await bcrypt.hash(password, 10);
  const rows = await sql`update accounts set password_hash = ${hash} where id = ${accountId} returning username`;
  if (!rows[0]) {
    res.status(404).json({ error: "No such account" });
    return;
  }
  await logAction(req.session.accountId, "account.reset_password", { accountId });
  res.status(200).json({ ok: true, username: rows[0].username, password });
}

async function saveAnnouncement(req, res) {
  const { id, message, active, sortOrder } = req.body || {};
  if (!message || !message.trim()) {
    res.status(400).json({ error: "message is required" });
    return;
  }
  if (id) {
    await sql`
      update announcements set message = ${message.trim()}, active = ${Boolean(active)}, sort_order = ${sortOrder ?? 0}
      where id = ${id}
    `;
  } else {
    await sql`
      insert into announcements (message, active, sort_order)
      values (${message.trim()}, ${active === undefined ? true : Boolean(active)}, ${sortOrder ?? 0})
    `;
  }
  await logAction(req.session.accountId, "announcement.save", { id });
  res.status(200).json({ ok: true });
}

/* replace which teams a core account is responsible for — an empty list
   means "no restriction", i.e. they see every team again */
async function saveAssignment(req, res) {
  const { coreAccountId, teamIds } = req.body || {};
  if (!coreAccountId || !Array.isArray(teamIds)) {
    res.status(400).json({ error: "coreAccountId and teamIds are required" });
    return;
  }
  await sql`delete from core_assignments where core_account_id = ${coreAccountId}`;
  for (const teamId of teamIds) {
    await sql`insert into core_assignments (core_account_id, team_id) values (${coreAccountId}, ${teamId})`;
  }
  await logAction(req.session.accountId, "assignment.save", { coreAccountId, count: teamIds.length });
  res.status(200).json({ ok: true });
}

export default requireRole(handler, ["admin"]);
