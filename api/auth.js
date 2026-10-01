import bcrypt from "bcryptjs";
import { sql } from "./_lib/db.js";
import { signSession, sessionCookie, clearSessionCookie, readSession } from "./_lib/auth.js";
import { logAction } from "./_lib/audit.js";
import { createIncident } from "./_lib/incidents.js";

/* Login, logout, "who am I", a team's own submission, and a team's SOS
   request share this file — Vercel's Hobby plan caps a deployment at 12
   serverless functions, so related endpoints branch on method / an
   `action` field rather than each getting its own route. GET = who am I;
   POST = login, or logout/submit/help if the body says so. */
export default async function handler(req, res) {
  if (req.method === "GET") return me(req, res);
  if (req.method === "POST") {
    const { action } = req.body || {};
    if (action === "logout") return logout(req, res);
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

  const { submissionUrl, submissionNote } = req.body || {};
  if (!submissionUrl || !submissionUrl.trim()) {
    res.status(400).json({ error: "A submission link is required" });
    return;
  }

  await sql`
    update teams set
      submission_url = ${submissionUrl.trim()},
      submission_note = ${submissionNote || null},
      submitted_at = now()
    where id = ${session.teamId}
  `;

  await logAction(session.accountId, "submission.save", { teamId: session.teamId });
  res.status(200).json({ ok: true });
}

async function login(req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  const rows = await sql`
    select id, username, password_hash, role, display_name
    from accounts
    where username = ${username.trim().toLowerCase()}
  `;
  const account = rows[0];

  // Same response whether the username doesn't exist or the password is
  // wrong, so a login attempt can't be used to fish for valid usernames.
  if (!account || !(await bcrypt.compare(password, account.password_hash))) {
    res.status(401).json({ error: "Incorrect username or password" });
    return;
  }

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

  res.setHeader("Set-Cookie", sessionCookie(token));
  res.status(200).json({
    role: account.role,
    displayName: account.display_name,
    team,
  });
}

async function logout(req, res) {
  res.setHeader("Set-Cookie", clearSessionCookie());
  res.status(200).json({ ok: true });
}

async function me(req, res) {
  const session = readSession(req);
  if (!session) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  let team = null;
  if (session.role === "team" && session.teamId) {
    const teamRows = await sql`
      select id, team_code, seat_no, qr_token, shortlisted,
        submission_url, submission_note, submitted_at
      from teams
      where id = ${session.teamId}
    `;
    team = teamRows[0] || null;
    if (team) {
      team.members = await sql`
        select id, name, is_lead
        from team_members
        where team_id = ${team.id}
        order by sort_order asc, id asc
      `;
      const markRows = await sql`
        select score, criteria, feedback
        from marks
        where team_id = ${team.id}
          and round_id = (select id from mentoring_rounds where round_no = 2)
      `;
      const mark = markRows[0];
      team.score = mark ? Number(mark.score) : null;
      team.criteria = mark?.criteria || null;
      team.feedback = mark?.feedback || null;
    }
  }

  const announcementRows = await sql`
    select message, pinned from announcements where active = true order by pinned desc, sort_order asc, id asc
  `;

  res.status(200).json({
    role: session.role,
    displayName: session.displayName,
    team,
    announcements: announcementRows.map((a) => ({ message: a.message, pinned: a.pinned })),
  });
}
