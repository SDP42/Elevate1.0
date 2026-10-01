import { sql } from "./_lib/db.js";
import { requireRole } from "./_lib/auth.js";

/* Any logged-in account. Teams only ever see revealed problem statements;
   admin and core see the full list (including hidden ones) so they can
   manage it before it goes live. Each one comes back with how many teams
   have already taken it, for a capacity readout. */
async function handler(req, res) {
  const canSeeAll = req.session.role === "admin" || req.session.role === "core";

  const rows = canSeeAll
    ? await sql`
        select p.id, p.code, p.title, p.description, p.capacity, p.revealed,
          (select count(*) from team_ps_selection s where s.ps_id = p.id) as taken
        from ps_list p
        order by p.sort_order asc, p.id asc
      `
    : await sql`
        select p.id, p.code, p.title, p.description, p.capacity, p.revealed,
          (select count(*) from team_ps_selection s where s.ps_id = p.id) as taken
        from ps_list p
        where p.revealed = true
        order by p.sort_order asc, p.id asc
      `;

  let selectedPsId = null;
  if (req.session.role === "team" && req.session.teamId) {
    const sel = await sql`select ps_id from team_ps_selection where team_id = ${req.session.teamId}`;
    selectedPsId = sel[0]?.ps_id ?? null;
  }

  res.status(200).json({
    selectedPsId,
    problemStatements: rows.map((p) => ({
      id: p.id,
      code: p.code,
      title: p.title,
      description: p.description,
      capacity: p.capacity,
      revealed: p.revealed,
      taken: Number(p.taken),
      full: p.capacity !== null && Number(p.taken) >= p.capacity,
    })),
  });
}

export default requireRole(handler);
