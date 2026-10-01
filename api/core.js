import { sql } from "./_lib/db.js";
import { requireRole } from "./_lib/auth.js";

/* Core (and admin) only: the marks-entry list and the save action share
   this file — see api/auth.js for why. GET lists teams with their Round 2
   score; POST saves one. Round 1 never carries marks, so there's no round
   parameter — this always writes against Round 2. */
async function handler(req, res) {
  if (req.method === "GET") return listTeams(req, res);
  if (req.method === "POST") return submitMark(req, res);
  res.status(405).json({ error: "Method not allowed" });
}

async function listTeams(req, res) {
  const teams = await sql`
    select t.id, t.team_code, t.seat_no, m.score
    from teams t
    left join marks m
      on m.team_id = t.id
      and m.round_id = (select id from mentoring_rounds where round_no = 2)
    order by t.id asc
  `;

  res.status(200).json({
    teams: teams.map((t) => ({
      id: t.id,
      teamCode: t.team_code,
      seatNo: t.seat_no,
      score: t.score === null ? null : Number(t.score),
    })),
  });
}

async function submitMark(req, res) {
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
