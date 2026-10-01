import { sql } from "../_lib/db.js";
import { requireRole } from "../_lib/auth.js";

/* Admin-only: every team, its seat, and its member roster — the in-app
   view of the database the admin account is meant to have, so nobody has
   to open a separate database console to see who's registered. */
async function handler(req, res) {
  const teams = await sql`
    select t.id, t.team_code, t.seat_no, a.display_name, a.username
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
      displayName: t.display_name,
      username: t.username,
      members: byTeam.get(t.id) || [],
    })),
  });
}

export default requireRole(handler, ["admin"]);
