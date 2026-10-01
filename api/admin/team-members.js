import { sql } from "../_lib/db.js";
import { requireRole } from "../_lib/auth.js";

/* Admin only: replace a team's roster wholesale — simplest correct way to
   swap the T1M1-style placeholders for real names once they're known,
   without needing a row-by-row add/remove/rename API. */
async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

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

  res.status(200).json({ ok: true });
}

export default requireRole(handler, ["admin"]);
