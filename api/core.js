import { sql } from "./_lib/db.js";
import { requireRole } from "./_lib/auth.js";
import { CRITERIA } from "../shared/criteria.js";

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
    select t.id, t.team_code, t.seat_no, m.score, m.criteria
    from teams t
    left join marks m
      on m.team_id = t.id
      and m.round_id = (select id from mentoring_rounds where round_no = 2)
    order by t.id asc
  `;

  res.status(200).json({
    criteria: CRITERIA,
    teams: teams.map((t) => ({
      id: t.id,
      teamCode: t.team_code,
      seatNo: t.seat_no,
      score: t.score === null ? null : Number(t.score),
      criteria: t.criteria || null,
    })),
  });
}

/* Expects { teamId, criteria: { <key>: number, ... } } — one entry per
   CRITERIA key. The total (score) is computed here, server-side, rather
   than trusted from the client, so it can never drift from the sum of
   what was actually entered. */
async function submitMark(req, res) {
  const { teamId, criteria } = req.body || {};
  if (!teamId || !criteria || typeof criteria !== "object") {
    res.status(400).json({ error: "teamId and a criteria score for each category are required" });
    return;
  }

  let total = 0;
  const clean = {};
  for (const c of CRITERIA) {
    const value = Number(criteria[c.key]);
    if (Number.isNaN(value) || value < 0 || value > c.max) {
      res.status(400).json({ error: `${c.label} must be a number between 0 and ${c.max}` });
      return;
    }
    clean[c.key] = value;
    total += value;
  }

  await sql`
    insert into marks (team_id, round_id, score, criteria, entered_by)
    select ${teamId}, id, ${total}, ${JSON.stringify(clean)}::jsonb, ${req.session.accountId}
    from mentoring_rounds where round_no = 2
    on conflict (team_id, round_id) do update set
      score = excluded.score,
      criteria = excluded.criteria,
      entered_by = excluded.entered_by,
      entered_at = now()
  `;

  res.status(200).json({ ok: true, score: total });
}

export default requireRole(handler, ["core", "admin"]);
