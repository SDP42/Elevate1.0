import { sql as defaultSql } from "./_lib/db.js";
import { requireRole } from "./_lib/auth.js";

/* Live standings use Judging Round 1. Frozen standings use final marks,
   restricted to teams shortlisted for the final round. Participant visibility
   continues to use the team's mentoring-feedback release gate. */
export function createLeaderboardHandler({sql=defaultSql}={}) {
async function handler(req, res) {
  const canSeeUnreleased = ["admin", "superadmin", "core"].includes(req.session.role);
  const settingRows = await sql`select value from settings where key = 'results_frozen'`;
  const frozen = settingRows[0]?.value === true;
  const rows = await sql`
    select t.team_code, t.seat_no, a.display_name, m.score
    from teams t
    join accounts a on a.id = t.account_id
    left join marks m
      on m.team_id = t.id
      and m.round_id = (select id from mentoring_rounds where round_no = ${frozen ? 4 : 3})
      and (${canSeeUnreleased} or exists (select 1 from marks published where published.team_id=t.id and published.round_id=(select id from mentoring_rounds where round_no=2) and published.feedback_approved=true))
    where t.withdrawn = false and t.shortlisted = true and (not ${frozen} or t.final_round_shortlisted)
    order by m.score desc nulls last, t.team_code asc
  `;



  let currentRank = 0;
  let lastScore = null;
  const leaderboard = rows.map((r, i) => {
    let rank = null;
    if (r.score !== null) {
      const numScore = Number(r.score);
      if (lastScore === null || numScore !== lastScore) {
        currentRank = i + 1;
        lastScore = numScore;
      }
      rank = currentRank;
    }
    return {
      rank,
      teamCode: r.team_code,
      teamName: r.display_name,
      displayName: r.display_name,
      seatNo: r.seat_no,
      score: r.score === null ? null : Number(r.score),
    };
  });

  res.status(200).json({
    frozen,
    leaderboard,
  });
}

return handler;
}
export default requireRole(createLeaderboardHandler());
