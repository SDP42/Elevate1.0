import { sql } from "../_lib/db.js";
import { requireRole } from "../_lib/auth.js";

/* Admin-only: the staff roster (core, meal, admin) — passwords are never
   stored anywhere retrievable, only their bcrypt hashes, so this lists who
   has an account, not what their password is. */
async function handler(req, res) {
  const accounts = await sql`
    select id, username, role, display_name, created_at
    from accounts
    where role != 'team'
    order by role asc, username asc
  `;
  res.status(200).json({ accounts });
}

export default requireRole(handler, ["admin"]);
