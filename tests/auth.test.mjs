import assert from "node:assert/strict";
import { test } from "node:test";
process.env.SESSION_SECRET = "isolated-unit-test-secret";
const { signSession, readSession, requireRole, verifySession, sessionCookie } = await import("../api/_lib/auth.js");

test("sessions verify signed identities and reject tampered tokens", () => {
  const token = signSession({ accountId: 1, role: "team", teamId: 1 });
  assert.equal(readSession({ headers: { cookie: `elevate_session=${token}` } }).role, "team");
  assert.equal(verifySession(token + "invalid"), null);
  assert.match(sessionCookie(token), /HttpOnly; SameSite=Lax/);
});
test("admin routes allow superadmin and reject team or missing sessions", async () => {
  let called = 0;
  const handler = requireRole(async () => { called += 1; }, ["admin", "superadmin"]);
  for (const role of ["admin", "superadmin", "team", null]) {
    let status;
    const req = { headers: { cookie: role ? `elevate_session=${signSession({ accountId: 1, role })}` : "" } };
    const res = { status(code) { status = code; return this; }, json() {} };
    await handler(req, res);
    if (role === "team" || role === null) assert.equal(status, 401);
  }
  assert.equal(called, 2);
});
