import { sql } from "../_lib/db.js";
import { requireRole } from "../_lib/auth.js";

/* Core (and admin) only: enters or updates a team's Round 2 score. Round 1
   is the online PS round and never carries marks, so there's deliberately
   no round parameter here — this always writes against Round 2. */
async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { teamId, score } = req.body || {};
  const parsedScore = Number(score);
  if (!teamId || Number.isNaN(parsedScore)) {
    res.status(400).json({ error: "teamId and a numeric score are required" });
    return;
  }

  await sql`
    insert into marks (team_id, round_id, score, entered_by)
    select ${teamId}, id, ${parsedScore}, ${req.session.accountId}
    from mentoring_rounds where round_no = 2
    on conflict (team_id, round_id) do update set
      score = excluded.score,
      entered_by = excluded.entered_by,
      entered_at = now()
  `;

  res.status(200).json({ ok: true });
}

export default requireRole(handler, ["core", "admin"]);
