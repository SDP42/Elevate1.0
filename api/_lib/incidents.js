import { sql } from "./db.js";

/* Shared by any endpoint that needs to raise an incident — a team's SOS, a
   meal counter flagging low stock, a guest headcount mismatch — so the
   insert itself isn't duplicated across files. See api/incidents.js for
   the admin-facing list/resolve side. */
export async function createIncident({ type, message, teamId, createdBy, createdRole }) {
  const rows = await sql`
    insert into incidents (type, message, team_id, created_by, created_role)
    values (${type}, ${message}, ${teamId ?? null}, ${createdBy ?? null}, ${createdRole ?? null})
    returning id, created_at
  `;
  return rows[0];
}
