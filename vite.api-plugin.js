import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Local adapter for the top-level Vercel API functions. Private _lib modules
// and filesystem paths are never exposed as routes.
export default function apiPlugin() {
  return {
    name: "elevate-api-dev-middleware",
    configureServer(server) {
      const apiDirectory = path.resolve(server.config.root, "api");
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();
        function json(status, payload) {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify(payload));
        }
        const route = req.url.split("?")[0].match(/^\/api\/([a-z][a-z0-9-]*)$/);
        if (!route) return json(404, { error: "Not found" });
        const filePath = path.join(apiDirectory, route[1] + ".js");
        if (!fs.existsSync(filePath)) return json(404, { error: "Not found" });
        try {
          const chunks = [];
          let bytes = 0;
          for await (const chunk of req) {
            bytes += chunk.length;
            if (bytes <= 4.4 * 1024 * 1024) chunks.push(chunk);
          }
          if (bytes > 4.4 * 1024 * 1024) return json(413, { error: "Request is too large" });
          const raw = Buffer.concat(chunks).toString("utf8");
          try {
            req.body = raw ? JSON.parse(raw) : undefined;
          } catch {
            return json(400, { error: "Invalid JSON body" });
          }
          if (req.body !== undefined && (req.body === null || typeof req.body !== "object" || Array.isArray(req.body))) {
            return json(400, { error: "A JSON object is required" });
          }
          if (!(process.env.DATABASE_URL || process.env.POSTGRES_URL)?.trim() || !process.env.SESSION_SECRET?.trim()) {
            return json(503, { error: "Sign-in is temporarily unavailable. Please contact an organiser.", code: "BACKEND_NOT_CONFIGURED" });
          }
          const mod = await import(`${pathToFileURL(filePath).href}?t=${fs.statSync(filePath).mtimeMs}`);
          if (typeof mod.default !== "function") throw new Error("Invalid API handler");
          const adapter = {
            statusCode: 200,
            status(code) { this.statusCode = code; return this; },
            setHeader(key, value) { res.setHeader(key, value); },
            json(payload) { json(this.statusCode, payload); },
            send(body) { res.statusCode = this.statusCode; res.end(body); },
          };
          await mod.default(req, adapter);
        } catch (err) {
          // Do not send database messages, connection strings or stack traces to clients.
          console.error(`Local API /${route[1]} failed (${err?.code || err?.name || "Error"}).`);
          if (!res.writableEnded) json(500, { error: "Unable to complete this request. Please try again." });
        }
      });
    },
  };
}
