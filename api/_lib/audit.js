import { sql } from "./db.js";

/* A plain trail of who did what — called alongside the mutations that
   actually matter, not read by any application logic itself. Never lets a
   logging failure break the real request: if this throws, it's swallowed
   and the calling action still succeeds. */
export async function logAction(accountId, action, detail) {
  try {
    await sql`
      insert into audit_log (actor_account_id, action, detail)
      values (${accountId ?? null}, ${action}, ${detail ? JSON.stringify(detail) : null}::jsonb)
    `;
  } catch {
    // auditing is best-effort — never let it block the real action
  }
}
