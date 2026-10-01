// Parses ?query=params from req.url without relying on a framework to have
// populated req.query — works the same under Vercel's Node runtime and the
// local Vite dev middleware (vite.api-plugin.js).
export function searchParams(req) {
  return new URL(req.url, "http://localhost").searchParams;
}
