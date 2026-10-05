import { sql } from "./_lib/db.js";
import { requireRole } from "./_lib/auth.js";

/* Problem statements: listing and a team's request share this file — see
   api/auth.js for why. GET is open to any logged-in account (teams only
   ever see revealed ones; admin/core see everything, hidden included, plus
   the raw request queue). POST is team-only, checked inline rather than at
   the wrapper, since the wrapper here just requires *a* session, not a
   specific role.

   PS allocation is first-come, first-served, but not automatic: a team's
   pick lands as a 'pending' request; only admin ticking it approved makes
   it official. "Taken"/capacity below counts approved requests only — a
   queue of pending requests doesn't consume a seat, so teams can freely
   request while admin works through the queue in order. Once a team's
   request is approved, it's locked — they can no longer change it. */
async function handler(req, res) {
  if (req.method === "GET") return list(req, res);
  if (req.method === "POST") return select(req, res);
  res.status(405).json({ error: "Method not allowed" });
}

async function list(req, res) {
  const canSeeAll = ["admin", "core", "superadmin"].includes(req.session.role);

  const rows = canSeeAll
    ? await sql`
        select p.id, p.code, p.title, p.description, p.capacity, p.revealed,
          (select count(*) from team_ps_selection s where s.ps_id = p.id and s.status = 'approved') as taken
        from ps_list p
        order by p.sort_order asc, p.id asc
      `
    : await sql`
        select p.id, p.code, p.title, p.description, p.capacity, p.revealed,
          (select count(*) from team_ps_selection s where s.ps_id = p.id and s.status = 'approved') as taken
        from ps_list p
        where p.revealed = true
        order by p.sort_order asc, p.id asc
      `;

  let mine = null;
  if (req.session.role === "team" && req.session.teamId) {
    const sel = await sql`
      select ps_id, status, requested_at from team_ps_selection where team_id = ${req.session.teamId}
    `;
    mine = sel[0] || null;
  }

  // visible to everyone logged in — "which team got which PS", once admin
  // has actually approved it, not just requested
  const allocations = await sql`
    select t.team_code, p.code as ps_code, p.title as ps_title
    from team_ps_selection s
    join teams t on t.id = s.team_id
    join ps_list p on p.id = s.ps_id
    where s.status = 'approved'
    order by p.sort_order asc, t.id asc
  `;

  res.status(200).json({
    selectedPsId: mine?.ps_id ?? null,
    selectionStatus: mine?.status ?? null,
    requestedAt: mine?.requested_at ?? null,
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
    allocations: allocations.map((a) => ({ teamCode: a.team_code, psCode: a.ps_code, psTitle: a.ps_title })),
  });
}

/* request (or change) a problem statement — can't request a hidden one,
   and can't touch it at all once admin has approved the team's current
   pick. Not capacity-checked here: that's enforced when admin approves,
   first-come-first-served by requested_at. */
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

  const psRows = await sql`select id, revealed from ps_list where id = ${psId}`;
  if (!psRows[0] || !psRows[0].revealed) {
    res.status(404).json({ error: "That problem statement isn't available" });
    return;
  }

  const currentRows = await sql`select status from team_ps_selection where team_id = ${teamId}`;
  if (currentRows[0]?.status === "approved") {
    res.status(409).json({ error: "Your problem statement is already approved and locked in" });
    return;
  }

  await sql`
    insert into team_ps_selection (team_id, ps_id, status, requested_at)
    values (${teamId}, ${psId}, 'pending', now())
    on conflict (team_id) do update set ps_id = excluded.ps_id, status = 'pending', requested_at = now()
  `;

  res.status(200).json({ ok: true });
}

export default requireRole(handler);
