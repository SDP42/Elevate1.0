# Participant AI gateway

Apply `db/ai-gateway.sql` explicitly to the database before deployment. Tables contain AES-256-GCM encrypted project/team keys; hashes authenticate team Bearer tokens. Encryption derives from SESSION_SECRET, which must match across local and production. Rotating it requires re-encrypting these credentials.

32 teams are mapped in code order: projects 1–2 have 6 teams each; projects 3–6 have 5 each. Each team gets 800,000 tokens/day, resetting at 00:00 UTC (05:30 IST). Project daily limit 5M, project minute limit 50K tokens/300 requests, team rate limit 10 requests/minute. Participants retrieve only their own key from `/api/ai-access` after login; admins retrieve secret-free usage and recent request metadata.

POST `/api/ai` from participant servers with `Authorization: Bearer <TEAM_API_KEY>`, model identifier, text messages and the model-specific output parameter. No project keys reach participants. Three supported models: gpt-5.6-luna, deepseek-v4-pro, gpt-5-mini. Output budget 1–4000 tokens; input JSON max 48KB. This release supports non-streaming text requests only. Requests containing stream=true are rejected explicitly.

Concurrent reservation transactions serialize on ai_requests. Conservative UTF-8 byte bounds plus output allowance reserve daily/project/minute quota before contacting the provider. Completed requests reconcile to usage.total_tokens. Timeouts, failed provider requests or missing usage retain their reservation; they are visible in monitoring. Prompts, response content and plaintext keys are never stored in request logs. Very large requests can exceed minute capacity even below the input byte ceiling.

Access starts 10 October 2026 and defaults to ending 11 October at 10:00 IST. Override AI_ACCESS_ENDS_AT with an ISO timestamp if the event window changes. All requests are rejected outside that window. Admin monitoring refreshes every 30s while visible.

To suspend a team: `update ai_team_access set enabled=false where team_id=...`. New requests are blocked; requests already sent upstream may complete. To rotate a team credential, generate a random token prefixed elev_, replace its SHA-256 key_hash and encrypted key_cipher together. Never commit or print project keys or participant tokens.

Verification: `node scripts/verify-ai-postgres.mjs` exercises concurrent daily and minute limits in isolated local PostgreSQL. Deployment verification should check authenticated credential retrieval, each project route and admin usage. Do not infer quota accuracy from the upstream estimated remaining-token headers.
