import bcrypt from "bcryptjs";
import { sql } from "./_lib/db.js";
import { signSession, sessionCookie, clearSessionCookie, readSession } from "./_lib/auth.js";

/* Login, logout and "who am I" in one function — Vercel's Hobby plan caps
   a deployment at 12 serverless functions, so related endpoints share a
   file and branch on method / an `action` field rather than each getting
   its own route. GET = who am I; POST = login, or logout if the body says
   so. */
export default async function handler(req, res) {
  if (req.method === "GET") return me(req, res);
  if (req.method === "POST") {
    const { action } = req.body || {};
    if (action === "logout") return logout(req, res);
    return login(req, res);
  }
  res.status(405).json({ error: "Method not allowed" });
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
      select id, team_code, seat_no, qr_token
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
    }
  }

  res.status(200).json({
    role: session.role,
    displayName: session.displayName,
    team,
  });
}
