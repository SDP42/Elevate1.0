import { createPsAllocation } from "./_lib/ps-allocation.js";
import { sql as defaultSql } from "./_lib/db.js";
import { requireRole } from "./_lib/auth.js";
import { psSelectionSchedule } from "../shared/ps-schedule.js";

/* Four ranked preferences are stored per team. The first available among
   preferences 1–4 is allocated automatically in one serialized transaction.
   Approved allocations remain locked. */
export function createPsHandler({sql=defaultSql, now=Date.now}={}) {
async function handler(req, res) {
  if (req.method === "GET") return list(req, res);
  if (req.method === "POST") return select(req, res);
  res.status(405).json({ error: "Method not allowed" });
}

async function list(req, res) {
  const canSeeAll = ["admin", "core", "superadmin"].includes(req.session.role);
  const schedule = psSelectionSchedule(now());
  if (!canSeeAll && now() < Date.parse(schedule.opensAt)) {
    return res.status(200).json({ ...schedule, preferences: [], selectedPsId: null,
      selectionStatus: null, requestedAt: null, problemStatements: [], allocations: [] });
  }

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

  let mine = null, preferences = [];
  if (req.session.role === "team" && req.session.teamId) {
    const sel = await sql`
      select ps_id, status, requested_at from team_ps_selection where team_id = ${req.session.teamId}
    `;
    mine = sel[0] || null;
    const pref=await sql`select preference1,preference2,preference3,preference4 from team_ps_preferences where team_id=${req.session.teamId}`;
    if(pref[0])preferences=[pref[0].preference1,pref[0].preference2,pref[0].preference3,pref[0].preference4];
  }

  // Confirmed allocations are visible to logged-in teams and staff.
  const allocations = await sql`
    select t.team_code, p.code as ps_code, p.title as ps_title
    from team_ps_selection s
    join teams t on t.id = s.team_id
    join ps_list p on p.id = s.ps_id
    where s.status = 'approved'
    order by p.sort_order asc, t.id asc
  `;

  res.status(200).json({
    ...psSelectionSchedule(now()),
    preferences,
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

async function select(req, res) {
  if (req.session.role !== "team") {
    res.status(403).json({ error: "Only a team account can select a problem statement" });
    return;
  }

  const teamId = req.session.teamId;
  const schedule = psSelectionSchedule(now());
  if (!schedule.selectionOpen) return res.status(403).json({ ...schedule,
    error: schedule.selectionClosed ? "Problem statement selection closed at 10:00 AM IST." : "Problem statement selection has not opened yet." });
  const { preferences } = req.body || {};
  if (!teamId || !Array.isArray(preferences) || preferences.length !== 4 || new Set(preferences).size !== 4 || preferences.some(id => !Number.isSafeInteger(id) || id < 1)) {
    return res.status(400).json({ error: "Choose four distinct problem statements in preference order" });
  }
  const result = await createPsAllocation(sql).allocatePreferences(teamId,preferences);
  if (!result.saved && !result.selection) return res.status(409).json({error:"Your team is withdrawn or one of these problem statements is unavailable. Refresh and try again."});
  res.status(200).json({ok:true,allocated:!!result.selection,selection:result.selection,
    message:result.selection?"Your problem statement is allocated and locked.":"Preferences saved. All four choices are full; no problem statement was allocated. Try again when capacity becomes available."});
}

return handler;
}
export default requireRole(createPsHandler());
