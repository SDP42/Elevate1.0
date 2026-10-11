import { SUBMISSION_CLOSES_AT, SUBMISSION_CLOSED_MESSAGE, submissionsClosed } from '../shared/submission-schedule.js';
import { partnerAccess } from "./_lib/partner-access.js";
import { secureHandler } from "./_lib/http.js";
import { submissionFiles as defaultSubmissionFiles } from "./_lib/submission-files.js";
import bcrypt from "bcryptjs";
import { sql as defaultSql } from "./_lib/db.js";
import { signSession, sessionCookie, clearSessionCookie, readSession } from "./_lib/auth.js";
import { logAction as defaultLogAction } from "./_lib/audit.js";
import { createIncident as defaultCreateIncident } from "./_lib/incidents.js";

// Injected dependencies let security tests exercise real handlers without
// contacting or changing the event database.
export function createAuthHandler({sql=defaultSql,logAction=defaultLogAction,createIncident=defaultCreateIncident,submissionFiles=defaultSubmissionFiles}={}) {

/* Login, logout, "who am I", a team's own submission, and a team's SOS
   request share this file — Vercel's Hobby plan caps a deployment at 12
   serverless functions, so related endpoints branch on method / an
   `action` field rather than each getting its own route. GET = who am I;
   POST = login, or logout/submit/help if the body says so. */
async function handler(req, res) {
  if (req.method === "GET") {
    if (new URL(req.url, "http://localhost").searchParams.get("resource") === "submission-files") return submissionFiles(req, res);
    return me(req, res);
  }
  if (req.method === "POST") {
    const { action } = req.body || {};
    if (action === "logout") return logout(req, res);
    if (action === "upload") return submissionFiles(req, res);
    if (action === "submit") return submitProject(req, res);
    if (action === "help") return requestHelp(req, res);
    return login(req, res);
  }
  res.status(405).json({ error: "Method not allowed" });
}

/* a team's SOS — 3am, something's broken, hunting someone down physically
   is slower than this reaching core/admin/regidesk directly */
async function requestHelp(req, res) {
  const session = readSession(req);
  if (!session || session.role !== "team" || !session.teamId) {
    res.status(401).json({ error: "Not authenticated as a team" });
    return;
  }
  const { message } = req.body || {};
  if (!message || !message.trim()) {
    res.status(400).json({ error: "A message is required" });
    return;
  }
  await createIncident({
    type: "sos",
    teamId: session.teamId,
    message: message.trim(),
    createdBy: session.accountId,
    createdRole: "team",
  });
  res.status(200).json({ ok: true });
}

/* a team's own submission — a link plus an optional note, saved against
   their own team row. Checked against the session's own teamId, so one
   team can never submit on another's behalf. */
async function submitProject(req, res) {
  const session = readSession(req);
  if (!session || session.role !== "team" || !session.teamId) {
    res.status(401).json({ error: "Not authenticated as a team" });
    return;
  }

  if (submissionsClosed()) return res.status(403).json({ error: SUBMISSION_CLOSED_MESSAGE });
  const { submissionUrl = "", submissionNote = "", submissionLinks } = req.body || {};
  if (typeof submissionUrl !== "string" || typeof submissionNote !== "string" || submissionNote.length > 10000) return res.status(400).json({ error: "Invalid submission" });
  if (submissionLinks !== undefined && (!Array.isArray(submissionLinks) || submissionLinks.length > 20 || submissionLinks.some(link => typeof link !== "string" || link.length > 2048))) {
    return res.status(400).json({error: "Add up to 20 additional links, each no longer than 2,048 characters."});
  }
  const links = submissionLinks === undefined ? null : [...new Set(submissionLinks.map(link => link.trim()).filter(Boolean))];
  if (links?.some(link => {try {return !['https:', 'http:'].includes(new URL(link).protocol);} catch {return true;}})) {
    return res.status(400).json({error: "Use a valid https:// or http:// URL for each additional link."});
  }
  if (submissionUrl.trim()) {
    try { if (!["https:", "http:"].includes(new URL(submissionUrl.trim()).protocol)) throw new Error(); }
    catch { return res.status(400).json({ error: "Use a valid https:// or http:// link" }); }
  } else if (!links?.length) {
    const files = await sql`select id from submission_files where team_id = ${session.teamId} limit 1`;
    if (!files.length) return res.status(400).json({ error: "Add a link or upload a file first" });
  }

  const saved = await sql`
    update teams set
      submission_url = ${submissionUrl.trim() || null},
      submission_links = coalesce(${links === null ? null : JSON.stringify(links)}::jsonb, submission_links),
      submission_note = ${submissionNote || null},
      submitted_at = now()
    where id = ${session.teamId} and clock_timestamp() < ${SUBMISSION_CLOSES_AT}::timestamptz
    returning id
  `;
  if (!saved.length) return res.status(403).json({ error: SUBMISSION_CLOSED_MESSAGE });

  await logAction(session.accountId, "submission.save", { teamId: session.teamId });
  res.status(200).json({ ok: true });
}

const LOGIN_ATTEMPT_LIMIT = 8;
const LOGIN_ATTEMPT_WINDOW_MINUTES = 15;

/* how many failed attempts this username has racked up in the last
   LOGIN_ATTEMPT_WINDOW_MINUTES — also sweeps anything older than that
   window so the table never accumulates stale rows */
async function recentFailedAttempts(username) {
  await sql`delete from login_attempts where attempted_at < now() - interval '1 hour'`;
  const rows = await sql`
    select count(*) as n from login_attempts
    where username = ${username} and attempted_at > now() - make_interval(mins => ${LOGIN_ATTEMPT_WINDOW_MINUTES})
  `;
  return Number(rows[0].n);
}

async function login(req, res) {
  const { username, password } = req.body || {};
  if (typeof username !== "string" || typeof password !== "string" || !username.trim() || !password || username.length > 128 || password.length > 1024) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }
  const cleanUsername = username.trim().toLowerCase();

  // locked out after too many wrong passwords in a row, for a short
  // cooldown — the account itself is never disabled, just slowed down
  const failures = await recentFailedAttempts(cleanUsername);
  if (failures >= LOGIN_ATTEMPT_LIMIT) {
    res.status(429).json({
      error: `Too many failed attempts. Try again in a few minutes, or ask admin to reset the password.`,
    });
    return;
  }

  const rows = await sql`
    select id, username, password_hash, role, display_name
    from accounts
    where lower(username) = ${cleanUsername}
  `;
  const account = rows[0];

  // Same response whether the username doesn't exist or the password is
  // wrong, so a login attempt can't be used to fish for valid usernames.
  if (!account || !(await bcrypt.compare(password, account.password_hash))) {
    await sql`insert into login_attempts (username) values (${cleanUsername})`;
    await logAction(null, "auth.login_failed", { username: cleanUsername });
    res.status(401).json({ error: "Incorrect username or password" });
    return;
  }

  // a clean login clears this account's slate — no reason to keep
  // counting against someone who just proved they know the password
  await sql`delete from login_attempts where lower(username) = ${cleanUsername}`;

  let team = null;
  if (account.role === "team") {
    const teamRows = await sql`
      select id, team_code, seat_no, qr_token
      from teams
      where account_id = ${account.id}
    `;
    team = teamRows[0] || null;
  }

  const token = signSession({
    accountId: account.id,
    role: account.role,
    displayName: account.display_name,
    teamId: team?.id,
  });

  await logAction(account.id, "auth.login", { username: account.username, role: account.role });
  res.setHeader("Set-Cookie", sessionCookie(token));
  res.status(200).json({
    role: account.role,
    displayName: account.display_name,
    team,
  });
}

async function logout(req, res) {
  const session = readSession(req);
  if (session) await logAction(session.accountId, "auth.logout", { username: session.displayName });
  res.setHeader("Set-Cookie", clearSessionCookie());
  res.status(200).json({ ok: true });
}

async function me(req, res) {
  const session = readSession(req);
  if (!session) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [account] = await sql`select id,display_name from accounts where id = ${session.accountId} and role = ${session.role}`;
  if (!account) {
    res.setHeader("Set-Cookie", clearSessionCookie());
    return res.status(401).json({ error: "Your session has expired. Please sign in again." });
  }
  let team = null;
  if (session.role === "team" && session.teamId) {
    const teamRows = await sql`
      select id, team_code, seat_no, qr_token, shortlisted, final_round_shortlisted,
        submission_url, submission_links, submission_note, submitted_at
      from teams
      where id = ${session.teamId}
    `;
    team = teamRows[0] || null;
    if (team) {
      team.partnerAccess = partnerAccess(team.team_code);
      team.members = await sql`
        select tm.id, tm.name, tm.is_lead,
          to_jsonb(tm)->>'food_preference' as food_preference,
          to_jsonb(tm)->>'college' as college
        from team_members tm
        where team_id = ${team.id}
        order by sort_order asc, id asc
      `;
      const markRows = await sql`
        select mentoring1_feedback, feedback, feedback_approved
        from marks
        where team_id = ${team.id}
          and round_id = (select id from mentoring_rounds where round_no = 2)
      `;
      const mark = markRows[0];
      // Participants receive released feedback only; scores remain staff-only.
      if (mark && mark.feedback_approved) {
        team.mentoring1Feedback = mark.mentoring1_feedback || null;
        team.mentoring2Feedback = mark.feedback || null;
      } else {
        team.mentoring1Feedback = null;
        team.mentoring2Feedback = null;
      }
    }
  }

  const announcementRows = await sql`
    select message, pinned from announcements where active = true and (team_id is null or team_id = ${session.role === "team" ? session.teamId : null}) order by pinned desc, sort_order asc, id asc
  `;

  res.status(200).json({
    role: session.role,
    displayName: account.display_name,
    team,
    announcements: announcementRows.map((a) => ({ message: a.message, pinned: a.pinned })),
  });
}

return secureHandler(handler);
}
export default createAuthHandler();
