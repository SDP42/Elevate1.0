import { sql } from "./_lib/db.js";
import { requireRole } from "./_lib/auth.js";
import { createIncident } from "./_lib/incidents.js";
import { logAction } from "./_lib/audit.js";

/* Event-day incidents and requests: a team's SOS, a meal counter's
   low-stock flag, a registration-desk guest note — one place organisers
   watch instead of chasing people down physically. Any logged-in account
   can raise one (POST, default action); only admin/core/regidesk can see
   the list or resolve one, since those are the roles actually walking the
   floor and able to act on it. */
async function handler(req, res) {
  if (req.method === "GET") {
    if (!["admin", "core", "regidesk", "superadmin"].includes(req.session.role)) {
      res.status(403).json({ error: "Not allowed to view incidents" });
      return;
    }
    return list(req, res);
  }

  if (req.method === "POST") {
    const { action } = req.body || {};
    if (action === "resolve") {
      if (!["admin", "core", "superadmin"].includes(req.session.role)) {
        res.status(403).json({ error: "Not allowed to resolve incidents" });
        return;
      }
      return resolve(req, res);
    }
    return raise(req, res);
  }

  res.status(405).json({ error: "Method not allowed" });
}

async function list(req, res) {
  const rows = await sql`
    select i.id, i.type, i.message, i.status, i.created_role, i.created_at,
      i.resolved_at, t.team_code,
      ra.username as resolved_by_username
    from incidents i
    left join teams t on t.id = i.team_id
    left join accounts ra on ra.id = i.resolved_by
    order by (i.status = 'open') desc, i.created_at desc
    limit 200
  `;
  res.status(200).json({
    incidents: rows.map((r) => ({
      id: r.id,
      type: r.type,
      message: r.message,
      status: r.status,
      createdRole: r.created_role,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
      resolvedByUsername: r.resolved_by_username,
      teamCode: r.team_code,
    })),
  });
}

/* A team can only ever raise against its own teamId (taken from the
   session, never trusted from the body); staff can optionally attach a
   teamId they're looking at (e.g. a meal counter flagging a guest). */
async function raise(req, res) {
  const { type, message } = req.body || {};
  const allowedTypes = ["sos", "guest", "late_arrival", "other"];
  if (!type || !allowedTypes.includes(type) || !message || !message.trim()) {
    res.status(400).json({ error: "A valid type and message are required" });
    return;
  }

  const teamId = req.session.role === "team" ? req.session.teamId : req.body?.teamId || null;

  const created = await createIncident({
    type,
    message: message.trim(),
    teamId,
    createdBy: req.session.accountId,
    createdRole: req.session.role,
  });

  await logAction(req.session.accountId, "incident.raise", { type, teamId });
  res.status(200).json({ ok: true, id: created.id });
}

async function resolve(req, res) {
  const { id } = req.body || {};
  if (!id) {
    res.status(400).json({ error: "id is required" });
    return;
  }
  await sql`
    update incidents set status = 'resolved', resolved_by = ${req.session.accountId}, resolved_at = now()
    where id = ${id}
  `;
  await logAction(req.session.accountId, "incident.resolve", { id });
  res.status(200).json({ ok: true });
}

export default requireRole(handler);
