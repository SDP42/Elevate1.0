import { partnerAccess } from "./_lib/partner-access.js";
import { mealAnalysis } from "./_lib/meal-analysis.js";
import { staffRevision } from "./_lib/staff-sync.js";
import { createPsAllocation } from "./_lib/ps-allocation.js";
import { saveRoster } from "./_lib/roster.js";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { sql as defaultSql } from "./_lib/db.js";
import { requireRole } from "./_lib/auth.js";
import { searchParams } from "./_lib/http.js";
import { logAction as defaultLogAction } from "./_lib/audit.js";

/* Every admin-only read and write in one function (see api/auth.js for why
   — the Hobby plan's 12-function cap). GET ?resource=... picks the read;
   POST {action: ...} picks the write. */
export function createAdminHandler({sql=defaultSql,logAction=defaultLogAction}={}) {
async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
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
    if (resource === "meal-analysis") {
      const revision = await staffRevision(sql, req, res);
      if (revision === null) return;
      const analysis = await mealAnalysis(sql, searchParams(req).get("slotCode"));
      if (!analysis) return res.status(404).json({ error: "Unknown meal slot" });
      return res.status(200).json({ ...analysis, revision, updatedAt: new Date().toISOString() });
    }
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
    if (action === "create-team") return createTeam(req, res);
    if (action === "create-staff") return createStaff(req, res);
    if (action === "final-shortlist") return finalShortlist(req,res);
    if (action === "approve-feedback") return approveFeedback(req, res);
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
      t.submission_url, t.submission_note, t.submitted_at, t.qr_token,
      a.id as account_id, a.display_name, a.username,
      (select count(*)::int from meal_logs ml where ml.team_id = t.id) as meals_claimed
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
      qrToken: t.qr_token,
      accountId: t.account_id,
      displayName: t.display_name,
      username: t.username,
      mealsClaimed: Number(t.meals_claimed),
      partnerAccess: partnerAccess(t.team_code),
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
  res.status(200).json({
    accounts: accounts.map((a) => ({
      id: a.id,
      username: a.username,
      role: a.role,
      display_name: a.display_name,
      created_at: a.created_at,
    })),
  });
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
    select id, message, active, pinned, sort_order, team_id from announcements order by pinned desc, sort_order asc, id asc
  `;
  res.status(200).json({
    announcements: rows.map((r) => ({
      id: r.id,
      message: r.message,
      teamId: r.team_id,
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

  const result = await createPsAllocation(sql).approve(teamId, req.session.accountId);
  if (!result.selection) {
    res.status(404).json({ error: "That team hasn't requested a problem statement" }); return;
  }
  if (result.selection.status !== "approved") {
    res.status(409).json({ error: "Cannot approve: check capacity, reveal status and the earlier requests in this PS queue. Refresh to see the current queue." }); return;
  }
  if (result.changed) await logAction(req.session.accountId, "ps.approve", { teamId, psId: result.selection.ps_id });
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
  await createPsAllocation(sql).revoke(teamId);
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
      select t.team_code, m.score, m.mentoring1_feedback, m.feedback,
        (select score from marks where team_id=t.id and round_id=(select id from mentoring_rounds where round_no=3)) as judging_score,
        (select score from marks where team_id=t.id and round_id=(select id from mentoring_rounds where round_no=4) and t.final_round_shortlisted) as final_score
      from teams t
      left join marks m on m.team_id = t.id and m.round_id = (select id from mentoring_rounds where round_no = 2)
      order by t.id asc
    `;
    body = toCsv(
      ["team", "mentoring_1_score", "judging_round_1_score", "final_round_score", "mentoring_1_feedback", "mentoring_2_feedback"],
      rows.map((r) => [r.team_code, r.score, r.judging_score, r.final_score, r.mentoring1_feedback, r.feedback])
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
  const { code, title, revealed, sortOrder } = req.body || {};
  if (typeof code !== "string" || typeof title !== "string" || !code.trim() || !title.trim() || code.length > 40 || title.length > 300) {
    res.status(400).json({ error: "code and title are required" });
    return;
  }

  await sql`
    insert into ps_list (code, title, description, capacity, revealed, sort_order)
    values (
      ${code.trim()},
      ${title.trim()},
      ${null},
      ${0},
      ${Boolean(revealed)},
      ${sortOrder ?? 0}
    )
    on conflict (code) do update set
      title = excluded.title,
      description = excluded.description,
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

  try { await saveRoster(sql, teamId, names); }
  catch (error) { if (error.code !== "ROSTER_CONFLICT") throw error; return res.status(409).json({ error: error.message }); }

  await logAction(req.session.accountId, "roster.save", { teamId });
  res.status(200).json({ ok: true });
}

function generateTeamUsername(displayName, teamCode) {
  if (/^ELEV\d{2,4}$/i.test(teamCode || "")) return teamCode.toLowerCase();
  const base = (displayName || teamCode || "team")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
  return `${base || "team"}_${crypto.randomBytes(3).toString("hex")}`;
}

/* rename a team's display name (e.g. "Team 1" → their real chosen
   name once finalised), preserving the issued username and QR token */
async function saveTeamName(req, res) {
  let { accountId, teamId, displayName } = req.body || {};
  if (!displayName || !displayName.trim()) {
    res.status(400).json({ error: "displayName is required" });
    return;
  }

  if (!accountId && teamId) {
    const tRows = await sql`select account_id from teams where id = ${teamId}`;
    accountId = tRows[0]?.account_id;
  }

  if (!accountId) {
    res.status(400).json({ error: "accountId or teamId is required" });
    return;
  }

  const cleanDisplayName = displayName.trim();
  const rows = await sql`
    update accounts
    set display_name = ${cleanDisplayName}
    where id = ${accountId} and role = 'team'
    returning id, username, display_name
  `;
  if (!rows[0]) {
    res.status(404).json({ error: "No team account with that id" });
    return;
  }
  await logAction(req.session.accountId, "team.rename", { accountId, displayName: cleanDisplayName });
  res.status(200).json({ ok: true, username: rows[0].username, displayName: cleanDisplayName });
}

/* mark which teams are the official Round 2 shortlist — auto-generates a QR token
   when shortlisted, and clears it when un-shortlisted */
async function setShortlist(req, res) {
  const { teamId, shortlisted } = req.body || {};
  if (!teamId) {
    res.status(400).json({ error: "teamId is required" });
    return;
  }
  const isShortlisted = Boolean(shortlisted);
  const rows = await sql`
    update teams
    set shortlisted = ${isShortlisted},
        qr_token = coalesce(qr_token, ${crypto.randomBytes(16).toString("hex")})
    where id = ${teamId}
    returning qr_token
  `;
  await logAction(req.session.accountId, "shortlist.set", { teamId, shortlisted: isShortlisted });
  res.status(200).json({ ok: true, qrToken: rows[0]?.qr_token });
}

/* manually create a new team account directly from the admin panel */
async function createTeam(req, res) {
  const { teamCode, displayName, seatNo, members, shortlisted } = req.body || {};
  if (!teamCode || !teamCode.trim()) {
    res.status(400).json({ error: "teamCode is required" });
    return;
  }
  const cleanCode = teamCode.trim().toUpperCase();
  if (!/^ELEV(?:0[1-9]|[1-9]\d{1,3})$/.test(cleanCode)) return res.status(400).json({ error: "Use an issued team code such as ELEV01" });
  const existingTeam = await sql`select id from teams where upper(team_code) = upper(${cleanCode})`;
  if (existingTeam[0]) {
    res.status(409).json({ error: `Team code ${cleanCode} already exists` });
    return;
  }

  const cleanName = displayName?.trim() || `Team ${cleanCode}`;
  let username = generateTeamUsername(cleanName, cleanCode);
  let existingAccount = await sql`select id from accounts where lower(username) = lower(${username})`;
  if (existingAccount[0] && /^ELEV\d{2,4}$/i.test(cleanCode)) {
    res.status(409).json({ error: "That ELEV login already exists" }); return;
  }
  while (existingAccount[0]) {
    username = generateTeamUsername(cleanName, cleanCode);
    existingAccount = await sql`select id from accounts where lower(username) = lower(${username})`;
  }

  const password = randomPassword();
  const passwordHash = await bcrypt.hash(password, 10);
  const isShortlisted = Boolean(shortlisted);
  // All Round 1 teams get a QR code immediately upon creation
  const qrToken = crypto.randomBytes(16).toString("hex");

  const accountRows = await sql`
    insert into accounts (username, password_hash, role, display_name)
    values (${username}, ${passwordHash}, 'team', ${cleanName})
    returning id
  `;
  const accountId = accountRows[0].id;

  const cleanSeat = seatNo !== "" && seatNo != null ? Number(seatNo) : null;
  const teamRows = await sql`
    insert into teams (account_id, team_code, seat_no, qr_token, shortlisted)
    values (${accountId}, ${cleanCode}, ${cleanSeat}, ${qrToken}, ${isShortlisted})
    returning id
  `;
  const teamId = teamRows[0].id;

  const rawNames = Array.isArray(members) ? members : (members || "").split("\n");
  const cleanNames = rawNames.map((n) => String(n).trim()).filter(Boolean);
  const memberList = cleanNames.length > 0 ? cleanNames.slice(0, 4) : [`${cleanCode} Member 1`, `${cleanCode} Member 2`];

  for (let i = 0; i < memberList.length; i += 1) {
    await sql`
      insert into team_members (team_id, name, is_lead, sort_order)
      values (${teamId}, ${memberList[i]}, ${i === 0}, ${i + 1})
    `;
  }

  await logAction(req.session.accountId, "team.create", { teamId, teamCode: cleanCode, shortlisted: isShortlisted });

  res.status(200).json({
    ok: true,
    teamId,
    accountId,
    teamCode: cleanCode,
    username,
    password,
    displayName: cleanName,
    seatNo: cleanSeat,
    shortlisted: isShortlisted,
    qrToken,
    members: memberList.map((name, i) => ({ id: i + 1, name, isLead: i === 0 })),
  });
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

/* paste a CSV export (team_code,team_name,name1,name2,name3,name4 or team_code,name1,name2,name3,name4)
   and populate teams, display names, usernames, and rosters in one go */
async function bulkImport(req, res) {
  const { csvText } = req.body || {};
  if (!csvText || !csvText.trim()) {
    res.status(400).json({ error: "csvText is required" });
    return;
  }

  const lines = csvText.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  const results = [];

  for (const line of lines) {
    // Skip optional CSV header line if present
    if (/^team_?code/i.test(line)) continue;

    const cols = line.split(",").map((c) => c.trim()).filter((c) => c.length > 0);
    if (cols.length < 2) {
      results.push({ teamCode: cols[0] || "(blank)", ok: false, error: "needs team code and members" });
      continue;
    }

    const teamCode = cols[0];
    let teamName = null;
    let names = [];

    // Check if line has at least 3 columns (teamCode, teamName, name1, [name2...])
    // If cols.length >= 3:
    // Format A: teamCode, teamName, member1, member2, ...
    // Format B (legacy): teamCode, member1, member2, member3, member4
    // We treat cols[1] as teamName if cols.length >= 3 and cols[1] is non-empty.
    if (cols.length >= 3) {
      teamName = cols[1];
      names = cols.slice(2, 6);
    } else {
      names = cols.slice(1, 5);
    }

    const cleanNames = names.filter(Boolean);
    if (cleanNames.length < 1) {
      results.push({ teamCode, ok: false, error: "needs at least 1-2 member names" });
      continue;
    }

    const teamRows = await sql`
      select t.id, t.account_id, a.username, a.display_name
      from teams t
      join accounts a on a.id = t.account_id
      where upper(t.team_code) = upper(${teamCode})
    `;
    let team = teamRows[0];
    let createdCredentials = null;

    if (!team) {
      // Create team on the fly if it doesn't exist
      const cleanCode = teamCode.toUpperCase();
      if (!/^ELEV(?:0[1-9]|[1-9]\d{1,3})$/.test(cleanCode)) { results.push({teamCode,ok:false,error:"New team codes must use ELEV01, ELEV02, etc."}); continue; }
      const displayName = teamName?.trim() || `Team ${cleanCode}`;
      let username = generateTeamUsername(displayName, cleanCode);
      let existingAccount = await sql`select id from accounts where lower(username) = lower(${username})`;
      if (existingAccount[0] && /^ELEV\d{2,4}$/i.test(cleanCode)) {
        results.push({teamCode,ok:false,error:"That ELEV login already exists"}); continue;
      }
      while (existingAccount[0]) {
        username = generateTeamUsername(displayName, cleanCode);
        existingAccount = await sql`select id from accounts where lower(username) = lower(${username})`;
      }

      const password = randomPassword();
      const passwordHash = await bcrypt.hash(password, 10);
      const qrToken = crypto.randomBytes(16).toString("hex");

      const accountRows = await sql`
        insert into accounts (username, password_hash, role, display_name)
        values (${username}, ${passwordHash}, 'team', ${displayName})
        returning id
      `;
      const accountId = accountRows[0].id;

      const newTeamRows = await sql`
        insert into teams (account_id, team_code, seat_no, qr_token, shortlisted)
        values (${accountId}, ${cleanCode}, null, ${qrToken}, false)
        returning id
      `;
      team = { id: newTeamRows[0].id, account_id: accountId, username, display_name: displayName };
      createdCredentials = { username, password };
    }

    try { await saveRoster(sql, team.id, cleanNames); }
    catch (error) { if (error.code !== "ROSTER_CONFLICT") throw error; results.push({ teamCode, ok: false, error: error.message }); continue; }
    if (teamName?.trim()) await sql`update accounts set display_name=${teamName.trim()} where id=${team.account_id}`;
    results.push({ teamCode, ok: true, ...(createdCredentials || {}) });
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
  const rows = await sql`
    update accounts
    set password_hash = ${hash}
    where id = ${accountId}
    returning username
  `;
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
  const { id, message, active, pinned, sortOrder, teamId = null } = req.body || {};
  if (typeof message !== "string" || !message.trim() || message.length > 10000) {
    res.status(400).json({ error: "message is required" });
    return;
  }
  if (teamId !== null && (!Number.isSafeInteger(teamId) || teamId < 1 || !(await sql`select id from teams where id = ${teamId}`).length)) {
    return res.status(400).json({ error: "Select an existing team or All" });
  }
  if (id) {
    await sql`
      update announcements
      set message = ${message.trim()}, active = ${Boolean(active)}, pinned = ${Boolean(pinned)}, sort_order = ${sortOrder ?? 0}, team_id = case when ${Object.hasOwn(req.body || {}, 'teamId')} then ${teamId}::int else team_id end
      where id = ${id}
    `;
  } else {
    await sql`
      insert into announcements (message, active, pinned, sort_order, team_id)
      values (${message.trim()}, ${active === undefined ? true : Boolean(active)}, ${Boolean(pinned)}, ${sortOrder ?? 0}, ${teamId})
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

/* create a new staff account (admin, core, meal, regidesk) */
async function createStaff(req, res) {
  const { role, username, displayName } = req.body || {};
  const validRoles = ["admin", "core", "meal", "regidesk"];
  if (!role || !validRoles.includes(role)) {
    res.status(400).json({ error: `role must be one of: ${validRoles.join(", ")}` });
    return;
  }
  let cleanUsername = username ? username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "") : "";
  if (!cleanUsername) {
    // Auto-generate username from role + next available index
    const existing = await sql`select username from accounts where role = ${role}`;
    let idx = existing.length + 1;
    let candidate = `${role}${String(idx).padStart(2, "0")}`;
    const taken = new Set(existing.map((e) => e.username));
    while (taken.has(candidate)) {
      idx += 1;
      candidate = `${role}${String(idx).padStart(2, "0")}`;
    }
    cleanUsername = candidate;
  } else {
    const existing = await sql`select id from accounts where username = ${cleanUsername}`;
    if (existing[0]) {
      res.status(409).json({ error: `Username ${cleanUsername} already exists` });
      return;
    }
  }

  const roleLabels = {
    admin: "Admin",
    core: "Core Judge",
    meal: "Meal Counter",
    regidesk: "Registration Desk",
  };
  const cleanName = displayName?.trim() || `${roleLabels[role] || role} ${cleanUsername}`;
  const password = randomPassword();
  const hash = await bcrypt.hash(password, 10);

  const rows = await sql`
    insert into accounts (username, password_hash, role, display_name)
    values (${cleanUsername}, ${hash}, ${role}, ${cleanName})
    returning id, username, role, display_name, created_at
  `;

  await logAction(req.session.accountId, "account.create_staff", {
    accountId: rows[0].id,
    username: cleanUsername,
    role,
  });

  res.status(200).json({
    ok: true,
    account: {
      id: rows[0].id,
      username: rows[0].username,
      role: rows[0].role,
      displayName: rows[0].display_name,
      password,
      createdAt: rows[0].created_at,
    },
  });
}

/* approve or withhold mentor feedback from being shown to teams.
   Supports releasing all results at once with { all: true, approved: true/false },
   or targeting a single team with { teamId, approved }. */
async function finalShortlist(req,res) {
  const {teamId,shortlisted}=req.body || {};
  if(!Number.isSafeInteger(teamId)||teamId<1||typeof shortlisted!=='boolean')return res.status(400).json({error:'A valid team and shortlist status are required'});
  const rows=await sql`update teams set final_round_shortlisted=${shortlisted} where id=${teamId} and not withdrawn returning id`;
  if(!rows.length)return res.status(404).json({error:'Active team not found'});
  await logAction(req.session.accountId,'team.final_shortlist',{teamId,shortlisted});
  return res.status(200).json({ok:true});
}

async function approveFeedback(req, res) {
  const { teamId, approved, all } = req.body || {};
  const isApproved = approved === undefined ? true : Boolean(approved);

  if (all) {
    const rows = await sql`
      update marks
      set feedback_approved = ${isApproved}
      where round_id = (select id from mentoring_rounds where round_no = 2)
      returning id
    `;
    await logAction(req.session.accountId, "feedback.approve_all", { count: rows.length, approved: isApproved });
    res.status(200).json({ ok: true, count: rows.length, approved: isApproved });
    return;
  }

  if (!teamId) {
    res.status(400).json({ error: "teamId or all: true is required" });
    return;
  }

  const rows = await sql`
    update marks
    set feedback_approved = ${isApproved}
    where team_id = ${teamId}
      and round_id = (select id from mentoring_rounds where round_no = 2)
    returning score, feedback_approved
  `;
  if (!rows[0]) {
    res.status(404).json({ error: "No Round 2 marks found for this team yet" });
    return;
  }
  await logAction(req.session.accountId, "feedback.approve", { teamId, approved: isApproved });
  res.status(200).json({ ok: true, approved: isApproved });
}

return handler;
}
export default requireRole(createAdminHandler(), ["admin", "superadmin"]);

