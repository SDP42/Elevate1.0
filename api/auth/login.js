import bcrypt from "bcryptjs";
import { sql } from "../_lib/db.js";
import { signSession, sessionCookie } from "../_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

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
