import { sql } from "./_lib/db.js";
import { requireRole } from "./_lib/auth.js";

/* Any logged-in account can see this — teams checking their standing,
   staff double-checking it matches what they entered. Round 1 never
   appears here since it doesn't carry marks; teams without a Round 2
   score yet are listed last, unscored. A withdrawn team drops off
   entirely rather than cluttering the board. `frozen` just tells the
   frontend to show this as the final result rather than a live one —
   admin flips it once, from the settings table, at the end of the event. */
async function handler(req, res) {
  const rows = await sql`
    select t.team_code, t.seat_no, a.display_name, m.score
    from teams t
    join accounts a on a.id = t.account_id
    left join marks m
      on m.team_id = t.id
      and m.round_id = (select id from mentoring_rounds where round_no = 2)
    where t.withdrawn = false and t.shortlisted = true
    order by m.score desc nulls last, t.team_code asc
  `;

  const settingRows = await sql`select value from settings where key = 'results_frozen'`;
  const frozen = settingRows[0]?.value === true;

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

export default requireRole(handler);
