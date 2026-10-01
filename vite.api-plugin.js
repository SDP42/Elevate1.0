import path from "node:path";
import { pathToFileURL } from "node:url";

/* Lets `vite dev` serve the /api/*.js serverless functions itself, in the
   same process — no `vercel dev` login needed for local development. Not
   used in production: Vercel deploys api/*.js as real serverless functions
   on its own, this plugin only exists so localhost works the same way. */
export default function apiPlugin() {
  return {
    name: "elevate-api-dev-middleware",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();

        const [urlPath] = req.url.split("?");
        const filePath = path.join(process.cwd(), urlPath.replace(/^\/api\//, "api/") + ".js");

        let mod;
        try {
          mod = await import(`${pathToFileURL(filePath).href}?t=${Date.now()}`);
        } catch {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Not found" }));
          return;
        }

        // collect and parse the JSON body, mirroring Vercel's Node runtime
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const raw = Buffer.concat(chunks).toString("utf8");
        req.body = raw ? JSON.parse(raw) : undefined;

        const vercelRes = {
          statusCode: 200,
          status(code) {
            this.statusCode = code;
            return this;
          },
          setHeader(key, value) {
            res.setHeader(key, value);
          },
          json(payload) {
            res.statusCode = this.statusCode;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(payload));
          },
          send(body) {
            res.statusCode = this.statusCode;
            res.end(body);
          },
        };

        try {
          await mod.default(req, vercelRes);
        } catch (err) {
          console.error(err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "Internal error" }));
        }
      });
    },
  };
}
