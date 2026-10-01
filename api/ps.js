import { sql } from "./_lib/db.js";
import { requireRole } from "./_lib/auth.js";

/* Problem statements: listing and a team's pick share this file — see
   api/auth.js for why. GET is open to any logged-in account (teams only
   ever see revealed ones; admin/core see everything, hidden included).
   POST is team-only, checked inline rather than at the wrapper, since the
   wrapper here just requires *a* session, not a specific role. */
async function handler(req, res) {
  if (req.method === "GET") return list(req, res);
  if (req.method === "POST") return select(req, res);
  res.status(405).json({ error: "Method not allowed" });
}

async function list(req, res) {
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

/* pick (or change) a problem statement — can't pick one that's hidden, and
   can't pick a full one unless it's already this team's own pick */
async function select(req, res) {
  if (req.session.role !== "team") {
    res.status(403).json({ error: "Only a team account can select a problem statement" });
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

export default requireRole(handler);
