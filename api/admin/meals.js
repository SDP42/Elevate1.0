import { sql } from "../_lib/db.js";
import { requireRole } from "../_lib/auth.js";

/* Admin-only: how many members have been served at each meal slot so far,
   across all teams — a quick glance, not a per-person audit (the meal
   counters' own scans are the per-person record in meal_logs). */
async function handler(req, res) {
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

export default requireRole(handler, ["admin"]);
