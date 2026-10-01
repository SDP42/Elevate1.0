import { sql } from "../_lib/db.js";
import { requireRole } from "../_lib/auth.js";

/* Admin only: create a problem statement, or update one that already
   exists (matched by its code) — same form either way, so revealing one
   later is just re-saving it with revealed turned on. */
async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

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

export default requireRole(handler, ["admin"]);
