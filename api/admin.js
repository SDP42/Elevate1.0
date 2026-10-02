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
      a.id as account_id, a.display_name, a.username, a.initial_password
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
      initialPassword: t.initial_password || "",
      members: byTeam.get(t.id) || [],
    })),
  });
}

/* the staff roster (core, meal, admin) */
async function getAccounts(req, res) {
  const accounts = await sql`
    select id, username, role, display_name, initial_password, created_at
    from accounts
    where role != 'team'
    order by role asc, username asc
  `;
  res.status(200).json({
    accounts: accounts.map((a) => ({
      id: a.id,
      username: a.username,
      role: a.role,
      display_name: a.display_name,
      initialPassword: a.initial_password || "",
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

function generateTeamUsername(displayName, teamCode) {
  const base = (displayName || teamCode || "team")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
  const randDigits = Math.floor(10 + Math.random() * 90);
  return `${base || "team"}_${randDigits}`;
}

/* rename a team's display name (e.g. "Team 1" → their real chosen
   name once finalised) — also updates the team's username to match
   <display_name>_<2_digits> so that logins and QR PNG names stay synced */
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
  let username = generateTeamUsername(cleanDisplayName, "");
  let existingAccount = await sql`select id from accounts where username = ${username} and id != ${accountId}`;
  while (existingAccount[0]) {
    username = generateTeamUsername(cleanDisplayName, "");
    existingAccount = await sql`select id from accounts where username = ${username} and id != ${accountId}`;
  }

  const rows = await sql`
    update accounts
    set display_name = ${cleanDisplayName},
        username = ${username}
    where id = ${accountId} and role = 'team'
    returning id, username, display_name
  `;
  if (!rows[0]) {
    res.status(404).json({ error: "No team account with that id" });
    return;
  }
  await logAction(req.session.accountId, "team.rename", { accountId, displayName: cleanDisplayName, username });
  res.status(200).json({ ok: true, username, displayName: cleanDisplayName });
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
  const existingTeam = await sql`select id from teams where upper(team_code) = upper(${cleanCode})`;
  if (existingTeam[0]) {
    res.status(409).json({ error: `Team code ${cleanCode} already exists` });
    return;
  }

  const cleanName = displayName?.trim() || `Team ${cleanCode}`;
  const baseName = (displayName || cleanCode || "team")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
  let randDigits = Math.floor(10 + Math.random() * 90);
  let username = `${baseName || "team"}_${randDigits}`;
  let existingAccount = await sql`select id from accounts where username = ${username}`;
  while (existingAccount[0]) {
    randDigits = Math.floor(10 + Math.random() * 90);
    username = `${baseName || "team"}_${randDigits}`;
    existingAccount = await sql`select id from accounts where username = ${username}`;
  }

  const password = randomPassword();
  const passwordHash = await bcrypt.hash(password, 10);
  const isShortlisted = Boolean(shortlisted);
  // All Round 1 teams get a QR code immediately upon creation
  const qrToken = crypto.randomBytes(16).toString("hex");

  const accountRows = await sql`
    insert into accounts (username, password_hash, role, display_name, initial_password)
    values (${username}, ${passwordHash}, 'team', ${cleanName}, ${password})
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

    if (!team) {
      // Create team on the fly if it doesn't exist
      const cleanCode = teamCode.toUpperCase();
      const displayName = teamName?.trim() || `Team ${cleanCode}`;
      let username = generateTeamUsername(displayName, cleanCode);
      let existingAccount = await sql`select id from accounts where username = ${username}`;
      while (existingAccount[0]) {
        username = generateTeamUsername(displayName, cleanCode);
        existingAccount = await sql`select id from accounts where username = ${username}`;
      }

      const password = randomPassword();
      const passwordHash = await bcrypt.hash(password, 10);
      const qrToken = crypto.randomBytes(16).toString("hex");

      const accountRows = await sql`
        insert into accounts (username, password_hash, role, display_name, initial_password)
        values (${username}, ${passwordHash}, 'team', ${displayName}, ${password})
        returning id
      `;
      const accountId = accountRows[0].id;

      const newTeamRows = await sql`
        insert into teams (account_id, team_code, seat_no, qr_token, shortlisted)
        values (${accountId}, ${cleanCode}, null, ${qrToken}, false)
        returning id
      `;
      team = { id: newTeamRows[0].id, account_id: accountId, username, display_name: displayName };
    } else if (teamName && teamName.trim()) {
      // Update display name and regenerate username based on team name
      const cleanDisplayName = teamName.trim();
      let username = generateTeamUsername(cleanDisplayName, teamCode);
      let existingAccount = await sql`select id from accounts where username = ${username} and id != ${team.account_id}`;
      while (existingAccount[0]) {
        username = generateTeamUsername(cleanDisplayName, teamCode);
        existingAccount = await sql`select id from accounts where username = ${username} and id != ${team.account_id}`;
      }

      await sql`
        update accounts
        set display_name = ${cleanDisplayName},
            username = ${username}
        where id = ${team.account_id}
      `;
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
  const rows = await sql`
    update accounts
    set password_hash = ${hash},
        initial_password = ${password}
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

export default requireRole(handler, ["admin"]);
