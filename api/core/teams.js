import { sql } from "../_lib/db.js";
import { requireRole } from "../_lib/auth.js";

/* Core (and admin) only: every team plus its Round 2 score, if a mentor's
   mark has been entered for it yet. */
async function handler(req, res) {
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

export default requireRole(handler, ["core", "admin"]);
