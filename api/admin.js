import { sql } from "./_lib/db.js";
import { requireRole } from "./_lib/auth.js";
import { searchParams } from "./_lib/http.js";

/* Every admin-only read and write in one function (see api/auth.js for why
   — the Hobby plan's 12-function cap). GET ?resource=teams|accounts|meals
   picks the read; POST {action: "save-ps" | "save-team-members"} picks
   the write. */
async function handler(req, res) {
  if (req.method === "GET") {
    const resource = searchParams(req).get("resource") || "teams";
    if (resource === "accounts") return getAccounts(req, res);
    if (resource === "meals") return getMeals(req, res);
    return getTeams(req, res);
  }

  if (req.method === "POST") {
    const { action } = req.body || {};
    if (action === "save-ps") return savePs(req, res);
    if (action === "save-team-members") return saveTeamMembers(req, res);
    res.status(400).json({ error: "Unknown action" });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}

/* every team, its seat, and its member roster — the in-app view of the
   database the admin account is meant to have */
async function getTeams(req, res) {
  const teams = await sql`
    select t.id, t.team_code, t.seat_no, a.display_name, a.username
    from teams t
    join accounts a on a.id = t.account_id
    order by t.id asc
  `;

  const members = await sql`
    select team_id, id, name, is_lead
    from team_members
    order by team_id asc, sort_order asc, id asc
  `;

  const byTeam = new Map();
  for (const m of members) {
    if (!byTeam.has(m.team_id)) byTeam.set(m.team_id, []);
    byTeam.get(m.team_id).push({ id: m.id, name: m.name, isLead: m.is_lead });
  }

  res.status(200).json({
    teams: teams.map((t) => ({
      id: t.id,
      teamCode: t.team_code,
      seatNo: t.seat_no,
      displayName: t.display_name,
      username: t.username,
      members: byTeam.get(t.id) || [],
    })),
  });
}

/* the staff roster (core, meal, admin) */
async function getAccounts(req, res) {
  const accounts = await sql`
    select id, username, role, display_name, created_at
    from accounts
    where role != 'team'
    order by role asc, username asc
  `;
  res.status(200).json({ accounts });
}

/* how many members have been served at each meal slot so far */
async function getMeals(req, res) {
  const rows = await sql`
    select ms.code, ms.label, ms.day_no, count(ml.id) as served
    from meal_slots ms
    left join meal_logs ml on ml.meal_slot_id = ms.id
    group by ms.id, ms.code, ms.label, ms.day_no
    order by ms.sort_order asc
  `;

  res.status(200).json({
    slots: rows.map((r) => ({
      code: r.code,
      label: r.label,
      dayNo: r.day_no,
      served: Number(r.served),
    })),
  });
}

/* create a problem statement, or update one that already exists (matched
   by its code) */
async function savePs(req, res) {
  const { code, title, description, capacity, revealed, sortOrder } = req.body || {};
  if (!code || !title) {
    res.status(400).json({ error: "code and title are required" });
    return;
  }

  await sql`
    insert into ps_list (code, title, description, capacity, revealed, sort_order)
    values (
      ${code.trim()},
      ${title.trim()},
      ${description || null},
      ${capacity === "" || capacity == null ? null : Number(capacity)},
      ${Boolean(revealed)},
      ${sortOrder ?? 0}
    )
    on conflict (code) do update set
      title = excluded.title,
      description = excluded.description,
      capacity = excluded.capacity,
      revealed = excluded.revealed,
      sort_order = excluded.sort_order
  `;

  res.status(200).json({ ok: true });
}

/* replace a team's roster wholesale — simplest correct way to swap the
   T1M1-style placeholders for real names */
async function saveTeamMembers(req, res) {
  const { teamId, members } = req.body || {};
  const names = (members || []).map((n) => String(n).trim()).filter(Boolean);

  if (!teamId || names.length < 2 || names.length > 4) {
    res.status(400).json({ error: "teamId and 2 to 4 member names are required" });
    return;
  }

  await sql`delete from team_members where team_id = ${teamId}`;
  for (let i = 0; i < names.length; i += 1) {
    await sql`
      insert into team_members (team_id, name, is_lead, sort_order)
      values (${teamId}, ${names[i]}, ${i === 0}, ${i + 1})
    `;
  }

  res.status(200).json({ ok: true });
}

export default requireRole(handler, ["admin"]);
