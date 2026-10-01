import { sql } from "../_lib/db.js";
import { readSession } from "../_lib/auth.js";

export default async function handler(req, res) {
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
