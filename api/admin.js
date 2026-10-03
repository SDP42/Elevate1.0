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
  const isSuper = req.session.role === "superadmin";

  if (req.method === "GET") {
    const resource = searchParams(req).get("resource") || "teams";
    // oversight views are superadmin-only — plain admin never sees who
    // logged in when, or how other staff (including admins) are behaving
    if (resource === "login-activity" || resource === "persona-activity" || resource === "audit-full") {
      if (!isSuper) {
        res.status(403).json({ error: "Super admin only" });
        return;
      }
      if (resource === "login-activity") return getLoginActivity(req, res);
      if (resource === "persona-activity") return getPersonaActivity(req, res);
      return getAuditFull(req, res);
    }
    if (resource === "accounts") return getAccounts(req, res);
    if (resource === "meals") return getMeals(req, res);
    if (resource === "audit") return getAudit(req, res);
    if (resource === "announcements") return getAnnouncements(req, res);
    if (resource === "assignments") return getAssignments(req, res);
    if (resource === "ps-requests") return getPsRequests(req, res);
    if (resource === "export") return exportCsv(req, res);
    if (resource === "overview") return getOverview(req, res);
    if (resource === "settings") return getSettings(req, res);
    return getTeams(req, res);
  }

  if (req.method === "POST") {
    const { action } = req.body || {};
    if (action === "save-ps") return savePs(req, res);
    if (action === "save-team-members") return saveTeamMembers(req, res);
    if (action === "save-team-name") return saveTeamName(req, res);
    if (action === "set-shortlist") return setShortlist(req, res);
    if (action === "save-team-notes") return saveTeamNotes(req, res);
    if (action === "bulk-import") return bulkImport(req, res);
    if (action === "reset-password") return resetPassword(req, res);
    if (action === "save-announcement") return saveAnnouncement(req, res);
    if (action === "save-assignment") return saveAssignment(req, res);
    if (action === "approve-ps") return approvePs(req, res);
    if (action === "revoke-ps") return revokePs(req, res);
    if (action === "set-withdrawn") return setWithdrawn(req, res);
    if (action === "freeze-results") return freezeResults(req, res);
    res.status(400).json({ error: "Unknown action" });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}

/* one glance at where the event stands — meant for a command-center view
   at the organiser desk rather than clicking through every section */
async function getOverview(req, res) {
  const [teamCount, withdrawnCount, checkedInCount, submittedCount, psApprovedCount, mealsServedCount, openIncidents] =
    await Promise.all([
      sql`select count(*) as n from teams`,
      sql`select count(*) as n from teams where withdrawn = true`,
      sql`select count(distinct member_id) as n from registration_checkins`,
      sql`select count(*) as n from teams where submitted_at is not null`,
      sql`select count(*) as n from team_ps_selection where status = 'approved'`,
      sql`select count(*) as n from meal_logs`,
      sql`select count(*) as n from incidents where status = 'open'`,
    ]);
  res.status(200).json({
    teamCount: Number(teamCount[0].n),
    withdrawnCount: Number(withdrawnCount[0].n),
    checkedInCount: Number(checkedInCount[0].n),
    submittedCount: Number(submittedCount[0].n),
    psApprovedCount: Number(psApprovedCount[0].n),
    mealsServedCount: Number(mealsServedCount[0].n),
    openIncidentsCount: Number(openIncidents[0].n),
  });
}

async function getSettings(req, res) {
  const rows = await sql`select value from settings where key = 'results_frozen'`;
  res.status(200).json({ resultsFrozen: rows[0]?.value === true });
}

/* freeze (or unfreeze) the public leaderboard as the final result — the
   data itself isn't snapshotted, this just tells every dashboard to show
   it as "final" rather than "live" */
async function freezeResults(req, res) {
  const { frozen } = req.body || {};
  await sql`
    insert into settings (key, value) values ('results_frozen', ${JSON.stringify(Boolean(frozen))}::jsonb)
    on conflict (key) do update set value = excluded.value
  `;
  await logAction(req.session.accountId, "results.freeze", { frozen: Boolean(frozen) });
  res.status(200).json({ ok: true });
}

/* a team dropping out overnight — excluded from the leaderboard, and its
   approved (or pending) PS request cleared so the seat frees up for
   someone else, without deleting anything else about the team */
async function setWithdrawn(req, res) {
  const { teamId, withdrawn } = req.body || {};
  if (!teamId) {
    res.status(400).json({ error: "teamId is required" });
    return;
  }
  await sql`update teams set withdrawn = ${Boolean(withdrawn)} where id = ${teamId}`;
  if (withdrawn) {
    await sql`delete from team_ps_selection where team_id = ${teamId}`;
  }
  await logAction(req.session.accountId, "team.set_withdrawn", { teamId, withdrawn: Boolean(withdrawn) });
  res.status(200).json({ ok: true });
}

/* every team, its seat, and its member roster — the in-app view of the
   database the admin account is meant to have */
async function getTeams(req, res) {
  const teams = await sql`
    select t.id, t.team_code, t.seat_no, t.dietary, t.shortlisted, t.withdrawn,
      t.submission_url, t.submission_note, t.submitted_at,
      a.id as account_id, a.display_name, a.username
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
      withdrawn: t.withdrawn,
      submissionUrl: t.submission_url,
      submissionNote: t.submission_note,
      submittedAt: t.submitted_at,
      accountId: t.account_id,
      displayName: t.display_name,
      username: t.username,
      members: byTeam.get(t.id) || [],
    })),
  });
}

/* the staff roster (core, meal, admin) */
async function getAccounts(req, res) {
  const isSuper = req.session.role === "superadmin";
  const accounts = await sql`
    select id, username, role, display_name, created_at
    from accounts
    where role != 'team' and (${isSuper} or role != 'superadmin')
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

/* Every login, logout and failed attempt, newest first, plus a per-account
   summary (last login, how many times, failures) — the "who got in, and
   when" view. Failed attempts carry no account id (the username may not
   even exist), so they're keyed by the username in their detail. */
async function getLoginActivity(req, res) {
  const events = await sql`
    select l.id, l.action, l.created_at,
      coalesce(a.username, l.detail->>'username') as username,
      coalesce(a.role, l.detail->>'role') as role
    from audit_log l
    left join accounts a on a.id = l.actor_account_id
    where l.action in ('auth.login', 'auth.logout', 'auth.login_failed')
    order by l.created_at desc
    limit 400
  `;
  const summary = await sql`
    select a.username, a.role, a.display_name,
      max(l.created_at) filter (where l.action = 'auth.login') as last_login,
      count(*) filter (where l.action = 'auth.login') as logins
    from accounts a
    left join audit_log l on l.actor_account_id = a.id
    group by a.id
    order by max(l.created_at) filter (where l.action = 'auth.login') desc nulls last, a.username asc
  `;
  const failed = await sql`
    select detail->>'username' as username, count(*) as n
    from audit_log where action = 'auth.login_failed' group by 1
  `;
  const failedBy = new Map(failed.map((f) => [f.username, Number(f.n)]));
  res.status(200).json({
    events: events.map((e) => ({
      id: e.id,
      action: e.action,
      at: e.created_at,
      username: e.username,
      role: e.role,
    })),
    accounts: summary.map((s) => ({
      username: s.username,
      role: s.role,
      displayName: s.display_name,
      lastLogin: s.last_login,
      logins: Number(s.logins),
      failedAttempts: failedBy.get(s.username) || 0,
    })),
  });
}

/* What each persona has actually been doing: per staff account action
   counts, plus the records they created (marks entered by each core
   account, meals served per counter, members checked in per desk). */
async function getPersonaActivity(req, res) {
  const actions = await sql`
    select a.username, a.role, count(l.id) as actions, max(l.created_at) as last_action
    from accounts a
    left join audit_log l on l.actor_account_id = a.id and l.action not like 'auth.%'
    where a.role != 'team'
    group by a.id
    order by a.role asc, a.username asc
  `;
  const marks = await sql`
    select a.username, count(m.id) as n from accounts a
    left join marks m on m.entered_by = a.id where a.role = 'core' group by a.id order by a.username
  `;
  const notes = await sql`
    select a.username, count(n.id) as n from accounts a
    left join round1_notes n on n.entered_by = a.id where a.role = 'core' group by a.id
  `;
  const meals = await sql`
    select a.username, count(ml.id) as n from accounts a
    left join meal_logs ml on ml.given_by = a.id where a.role = 'meal' group by a.id order by a.username
  `;
  const regi = await sql`
    select a.username, count(rc.member_id) as n from accounts a
    left join registration_checkins rc on rc.checked_in_by = a.id where a.role = 'regidesk' group by a.id order by a.username
  `;
  const noteBy = new Map(notes.map((n) => [n.username, Number(n.n)]));
  res.status(200).json({
    accounts: actions.map((a) => ({
      username: a.username,
      role: a.role,
      actions: Number(a.actions),
      lastAction: a.last_action,
    })),
    core: marks.map((m) => ({ username: m.username, marksEntered: Number(m.n), round1Notes: noteBy.get(m.username) || 0 })),
    meal: meals.map((m) => ({ username: m.username, served: Number(m.n) })),
    regidesk: regi.map((r) => ({ username: r.username, membersChecked: Number(r.n) })),
  });
}

/* the whole audit trail, filterable by actor role and action prefix */
async function getAuditFull(req, res) {
  const params = searchParams(req);
  const role = params.get("role") || "";
  const prefix = params.get("action") || "";
  const limit = Math.min(Number(params.get("limit")) || 300, 1000);
  const rows = await sql`
    select l.id, l.action, l.detail, l.created_at, a.username, a.role
    from audit_log l
    left join accounts a on a.id = l.actor_account_id
    where (${role} = '' or a.role = ${role})
      and (${prefix} = '' or l.action like ${prefix + "%"})
    order by l.created_at desc
    limit ${limit}
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
  const rows = await sql`
    select id, message, active, pinned, sort_order from announcements order by pinned desc, sort_order asc, id asc
  `;
  res.status(200).json({
    announcements: rows.map((r) => ({
      id: r.id,
      message: r.message,
      active: r.active,
      pinned: r.pinned,
      sortOrder: r.sort_order,
    })),
  });
}

async function getAssignments(req, res) {
  const cores = await sql`select id, username, display_name from accounts where role = 'core' order by username`;
  const assignments = await sql`select core_account_id, team_id, slot_time from core_assignments`;
  const byCore = new Map();
  const slotsByCore = new Map();
  for (const a of assignments) {
    if (!byCore.has(a.core_account_id)) byCore.set(a.core_account_id, []);
    byCore.get(a.core_account_id).push(a.team_id);
    if (a.slot_time) {
      if (!slotsByCore.has(a.core_account_id)) slotsByCore.set(a.core_account_id, {});
      slotsByCore.get(a.core_account_id)[a.team_id] = a.slot_time;
    }
  }
  res.status(200).json({
    cores: cores.map((c) => ({
      id: c.id,
      username: c.username,
      displayName: c.display_name,
      teamIds: byCore.get(c.id) || [],
      slotTimes: slotsByCore.get(c.id) || {},
    })),
  });
}

/* every PS request, in first-come-first-served order within each PS, for
   admin to work through and approve */
async function getPsRequests(req, res) {
  const rows = await sql`
    select t.id as team_id, t.team_code, p.id as ps_id, p.code as ps_code, p.title as ps_title,
      p.capacity, s.status, s.requested_at,
      (select count(*) from team_ps_selection s2 where s2.ps_id = p.id and s2.status = 'approved') as taken
    from team_ps_selection s
    join teams t on t.id = s.team_id
    join ps_list p on p.id = s.ps_id
    order by p.sort_order asc, s.requested_at asc
  `;
  res.status(200).json({
    requests: rows.map((r) => ({
      teamId: r.team_id,
      teamCode: r.team_code,
      psId: r.ps_id,
      psCode: r.ps_code,
      psTitle: r.ps_title,
      capacity: r.capacity,
      taken: Number(r.taken),
      status: r.status,
      requestedAt: r.requested_at,
    })),
  });
}

/* approve a team's current PS request — refuses once the PS is already at
   capacity (counting only other already-approved teams), so admin can
   approve strictly in the first-come-first-served order shown and trust
   the server to stop them over-filling one */
async function approvePs(req, res) {
  const { teamId } = req.body || {};
  if (!teamId) {
    res.status(400).json({ error: "teamId is required" });
    return;
  }

  const rows = await sql`
    select s.ps_id, s.status, p.capacity
    from team_ps_selection s
    join ps_list p on p.id = s.ps_id
    where s.team_id = ${teamId}
  `;
  const current = rows[0];
  if (!current) {
    res.status(404).json({ error: "That team hasn't requested a problem statement" });
    return;
  }
  if (current.status === "approved") {
    res.status(200).json({ ok: true });
    return;
  }

  if (current.capacity !== null) {
    const takenRows = await sql`
      select count(*) as n from team_ps_selection where ps_id = ${current.ps_id} and status = 'approved'
    `;
    if (Number(takenRows[0].n) >= current.capacity) {
      res.status(409).json({ error: "That problem statement is already at capacity" });
      return;
    }
  }

  await sql`
    update team_ps_selection
    set status = 'approved', approved_at = now(), approved_by = ${req.session.accountId}
    where team_id = ${teamId}
  `;
  await logAction(req.session.accountId, "ps.approve", { teamId, psId: current.ps_id });
  res.status(200).json({ ok: true });
}

/* undo an approval — the team's request goes back to pending, freeing the
   seat for someone else next in line */
async function revokePs(req, res) {
  const { teamId } = req.body || {};
  if (!teamId) {
    res.status(400).json({ error: "teamId is required" });
    return;
  }
  await sql`
    update team_ps_selection set status = 'pending', approved_at = null, approved_by = null
    where team_id = ${teamId}
  `;
  await logAction(req.session.accountId, "ps.revoke", { teamId });
  res.status(200).json({ ok: true });
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

/* rename a team's own display name (e.g. "Team 1" → their real chosen
   name once finalised) — touches accounts.display_name only, never the
   username, password, or qr_token, so nothing they've already been
   given (login, boarding pass) needs reissuing */
async function saveTeamName(req, res) {
  const { accountId, displayName } = req.body || {};
  if (!accountId || !displayName || !displayName.trim()) {
    res.status(400).json({ error: "accountId and displayName are required" });
    return;
  }
  const rows = await sql`
    update accounts set display_name = ${displayName.trim()} where id = ${accountId} and role = 'team'
    returning id
  `;
  if (!rows[0]) {
    res.status(404).json({ error: "No team account with that id" });
    return;
  }
  await logAction(req.session.accountId, "team.rename", { accountId });
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
  // only a superadmin may reset a superadmin — otherwise any admin could
  // take over the oversight account
  const targetRows = await sql`select role from accounts where id = ${accountId}`;
  if (targetRows[0]?.role === "superadmin" && req.session.role !== "superadmin") {
    res.status(403).json({ error: "Only a super admin can reset this account" });
    return;
  }
  const password = randomPassword();
  const hash = await bcrypt.hash(password, 10);
  const rows = await sql`update accounts set password_hash = ${hash} where id = ${accountId} returning username`;
  if (!rows[0]) {
    res.status(404).json({ error: "No such account" });
    return;
  }
  // a fresh password should actually let them back in — clear any lockout
  // from attempts against the old one
  await sql`delete from login_attempts where username = ${rows[0].username}`;
  await logAction(req.session.accountId, "account.reset_password", { accountId });
  res.status(200).json({ ok: true, username: rows[0].username, password });
}

async function saveAnnouncement(req, res) {
  const { id, message, active, pinned, sortOrder } = req.body || {};
  if (!message || !message.trim()) {
    res.status(400).json({ error: "message is required" });
    return;
  }
  if (id) {
    await sql`
      update announcements
      set message = ${message.trim()}, active = ${Boolean(active)}, pinned = ${Boolean(pinned)}, sort_order = ${sortOrder ?? 0}
      where id = ${id}
    `;
  } else {
    await sql`
      insert into announcements (message, active, pinned, sort_order)
      values (${message.trim()}, ${active === undefined ? true : Boolean(active)}, ${Boolean(pinned)}, ${sortOrder ?? 0})
    `;
  }
  await logAction(req.session.accountId, "announcement.save", { id });
  res.status(200).json({ ok: true });
}

/* replace which teams a core account is responsible for — an empty list
   means "no restriction", i.e. they see every team again. slotTimes is an
   optional { teamId: "10:00 AM" } map, so a narrowed-down mentor can also
   get a schedule instead of every assigned team at once. */
async function saveAssignment(req, res) {
  const { coreAccountId, teamIds, slotTimes } = req.body || {};
  if (!coreAccountId || !Array.isArray(teamIds)) {
    res.status(400).json({ error: "coreAccountId and teamIds are required" });
    return;
  }
  await sql`delete from core_assignments where core_account_id = ${coreAccountId}`;
  for (const teamId of teamIds) {
    const slotTime = slotTimes && slotTimes[teamId] ? String(slotTimes[teamId]).trim() : null;
    await sql`
      insert into core_assignments (core_account_id, team_id, slot_time) values (${coreAccountId}, ${teamId}, ${slotTime || null})
    `;
  }
  await logAction(req.session.accountId, "assignment.save", { coreAccountId, count: teamIds.length });
  res.status(200).json({ ok: true });
}

export default requireRole(handler, ["admin", "superadmin"]);
