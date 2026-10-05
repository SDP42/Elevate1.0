// Parses ?query=params from req.url without relying on a framework to have
// populated req.query — works the same under Vercel's Node runtime and the
// local Vite dev middleware (vite.api-plugin.js).
export function searchParams(req) {
  return new URL(req.url, "http://localhost").searchParams;
}

// Shared for local and deployed handlers: protect cookie-authenticated writes
// from other sites, avoid caching private responses, and redact internal errors.
export function secureHandler(handler) {
  return async (req, res) => {
    res.setHeader?.('Cache-Control', 'private, no-store');
    res.setHeader?.('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method || 'GET')) {
      const origin = req.headers?.origin;
      const host = req.headers?.host;
      let crossOrigin = req.headers?.['sec-fetch-site'] === 'cross-site';
      if (origin) {
        try { crossOrigin ||= !host || new URL(origin).host !== host; }
        catch { crossOrigin = true; }
      }
      if (crossOrigin) return res.status(403).json({ error: 'Cross-site requests are not allowed' });
    }
    try { return await handler(req, res); }
    catch (error) {
      console.error(`API request failed (${error?.code || error?.name || 'Error'}).`);
      return res.status(500).json({ error: 'Unable to complete this request. Please try again.' });
    }
  };
}
