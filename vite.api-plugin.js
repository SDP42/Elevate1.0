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
      // This private file enables a local scoring sandbox; Vercel never uses this adapter.
      const scorePreviewPath = path.resolve(server.config.root, ".local-release-check/mentoring-score-preview.json");
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
            json(payload) {
              if (route[1] === "core" && req.method === "GET" && this.statusCode === 200 && fs.existsSync(scorePreviewPath) && Array.isArray(payload.teams)) {
                const preview = JSON.parse(fs.readFileSync(scorePreviewPath, "utf8"));
                payload = {...payload, localScorePreview: true, teams: payload.teams.map(team => {
                  const entry = preview.teams.find(row => row.teamCode === team.teamCode);
                  return entry ? {...team, score: entry.score, mentoring1Score: entry.score,
                    localMentoringCriteria: entry.criteria,
                    feedbackApproved: Boolean(preview.released),
                    ...(entry.feedback || {})} : team;
                })};
              }
              if (req.method === "GET" && this.statusCode === 200 && fs.existsSync(scorePreviewPath)) {
                const preview = JSON.parse(fs.readFileSync(scorePreviewPath, "utf8"));
                if (preview.released && route[1] === "auth" && payload.role === "team" && payload.team) {
                  const entry = preview.teams.find(row => row.teamCode === payload.team.team_code);
                  if (entry) payload = {...payload, team: {...payload.team, mentoring1Score: entry.score,
                    localMentoringCriteria: entry.criteria,
                    mentoring1Feedback: entry.feedback?.mentoring1Feedback || null,
                    mentoring2Feedback: entry.feedback?.mentoring2Feedback || null}};
                }
                if (preview.released && route[1] === "leaderboard" && Array.isArray(payload.leaderboard)) {
                  let lastScore = null, rank = 0;
                  const leaderboard = [...preview.teams].sort((a,b) => b.score-a.score || a.teamCode.localeCompare(b.teamCode)).map((entry,index) => {
                    if (entry.score !== lastScore) rank = index + 1;
                    lastScore = entry.score;
                    return {rank, teamCode: entry.teamCode, teamName: entry.teamName, displayName: entry.teamName,
                      seatNo: payload.leaderboard.find(row => row.teamCode === entry.teamCode)?.seatNo ?? null, score: entry.score};
                  });
                  payload = {...payload, frozen: false, scoreStage: "mentoring1", leaderboard};
                }
              }
              json(this.statusCode, payload);
            },
            send(body) { res.statusCode = this.statusCode; res.end(body); },
          };
          const sessionAction = route[1] === "auth" && req.method === "POST" && [undefined, "login", "logout"].includes(req.body?.action);
          if (fs.existsSync(scorePreviewPath) && !["GET", "HEAD", "OPTIONS"].includes(req.method) && !sessionAction) {
            const {requireRole} = await import(pathToFileURL(path.join(apiDirectory, "_lib/auth.js")).href);
            await requireRole(async (request, response) => {
              const {teamId, score, stage = "mentoring1", action, mentoring1Feedback = "", mentoring2Feedback = ""} = request.body || {};
              if (route[1] !== "core" || request.method !== "POST" || action || stage !== "mentoring1") {
                return response.status(409).json({error: "Local marks preview is active. Other database changes are disabled."});
              }
              if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 100 ||
                  [mentoring1Feedback, mentoring2Feedback].some(value => typeof value !== "string" || value.length > 10000)) {
                return response.status(400).json({error: "A score from 0 to 100 and valid feedback are required."});
              }
              const preview = JSON.parse(fs.readFileSync(scorePreviewPath, "utf8"));
              const entry = preview.teams.find(row => row.teamId === Number(teamId));
              if (!entry) return response.status(404).json({error: "Team not found in local preview."});
              entry.score = score;
              entry.feedback = {mentoring1Feedback: mentoring1Feedback.trim(), mentoring2Feedback: mentoring2Feedback.trim()};
              fs.writeFileSync(scorePreviewPath + ".tmp", JSON.stringify(preview, null, 2), {mode: 0o600});
              fs.renameSync(scorePreviewPath + ".tmp", scorePreviewPath);
              response.status(200).json({ok: true, score, stage, localOnly: true});
            }, ["admin", "superadmin"])(req, adapter);
            return;
          }
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
