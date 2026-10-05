import { secureHandler } from "./http.js";
import jwt from "jsonwebtoken";

const SECRET = process.env.SESSION_SECRET;
const COOKIE_NAME = "elevate_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days — spans registration through the event

if (!SECRET) {
  throw new Error("SESSION_SECRET is not set — see db/SETUP.md.");
}

export function signSession(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: MAX_AGE_SECONDS });
}

export function verifySession(token) {
  try {
    return jwt.verify(token, SECRET, { algorithms: ["HS256"] });
  } catch {
    return null;
  }
}

export function sessionCookie(token) {
  const secure = process.env.VERCEL_ENV ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}${secure}`;
}

export function clearSessionCookie() {
  const secure = process.env.VERCEL_ENV ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function readSession(req) {
  const header = req.headers.cookie || "";
  const match = header.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  return verifySession(match[1]);
}

/* Wrap an API handler so it 401s unless the session's role is in `roles`
   (or any authenticated role, when `roles` is omitted). Attaches the
   decoded session to req.session. */
export function requireRole(handler, roles) {
  return secureHandler(async (req, res) => {
    const session = readSession(req);
    if (!session || (roles && !roles.includes(session.role))) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    req.session = session;
    return handler(req, res);
  });
}
