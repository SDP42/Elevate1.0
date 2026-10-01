import { sql } from "../_lib/db.js";
import { requireRole } from "../_lib/auth.js";

/* Team only: pick (or change) a problem statement. Can't pick one that's
   hidden, and can't pick a full one — unless it's already this team's own
   pick, so re-confirming a near-capacity choice never locks a team out of
   the one they already hold. */
async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const teamId = req.session.teamId;
  const { psId } = req.body || {};
  if (!teamId || !psId) {
    res.status(400).json({ error: "psId is required" });
    return;
  }

  const psRows = await sql`select id, revealed, capacity from ps_list where id = ${psId}`;
  const ps = psRows[0];
  if (!ps || !ps.revealed) {
    res.status(404).json({ error: "That problem statement isn't available" });
    return;
  }

  const currentRows = await sql`select ps_id from team_ps_selection where team_id = ${teamId}`;
  const alreadyHasThisOne = currentRows[0]?.ps_id === psId;

  if (ps.capacity !== null && !alreadyHasThisOne) {
    const takenRows = await sql`select count(*) as n from team_ps_selection where ps_id = ${psId}`;
    if (Number(takenRows[0].n) >= ps.capacity) {
      res.status(409).json({ error: "That problem statement just filled up — pick another" });
      return;
    }
  }

  await sql`
    insert into team_ps_selection (team_id, ps_id)
    values (${teamId}, ${psId})
    on conflict (team_id) do update set ps_id = excluded.ps_id, selected_at = now()
  `;

  res.status(200).json({ ok: true });
}

export default requireRole(handler, ["team"]);
