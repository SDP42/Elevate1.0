# Elevate 1.0

React/Vite website with a participant and staff portal. The backend is a set
of Node.js Vercel serverless functions in `api/`, backed by Neon PostgreSQL.
Sessions use signed JWTs in HttpOnly cookies; passwords use bcrypt hashes.

## Local development

Use Node 22.12 or newer. Install with `npm ci`, copy `.env.example` to the
untracked `.env`, and set `DATABASE_URL` and `SESSION_SECRET` locally.
Protect the file with `chmod 600 .env`. Never put database credentials or
participant passwords in source files or frontend environment variables.

Run `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`, then open
http://127.0.0.1:5173/portal/login. The Vite API adapter serves `/api/*`
locally, so Vercel CLI login is not required.

Login uses organiser-issued credentials. Selecting an account type changes
form guidance; the authenticated account determines its dashboard and permissions.
Super-admin access uses the existing `superadmin` account and is retained in
this integration. No default or shared password is provided.

## Database setup and credentials

See `db/SETUP.md`. For an existing database, preserve accounts and event history.
The hardening feature needs `marks.feedback_approved`; add it with a reviewed
migration before using feedback approval. Changing a score resets its approval.
Participant leaderboard scores are hidden until approved by an admin.

`npm run db:seed` adds missing demo accounts without resetting existing logins
or truncating tables. To supply private credentials for missing accounts:
`npm run db:seed -- --credentials-file /absolute/private/accounts.json`.
Use a fresh development database when trying seed or simulation workflows.

Passwords are shown once after account creation/reset. Account lists and
`node --env-file=.env scripts/export-credentials.mjs` export metadata only;
passwords and QR tokens are excluded from that CSV. Private seed credential
archives are ignored by Git and saved with owner-only permissions.

An older hardening deployment may have an `initial_password` column. Deploy
this API first, then explicitly remove that column using:
`node --env-file=.env db/remove-plaintext-passwords.mjs --confirm-remove-plaintext-passwords`.
This permanently removes plaintext copies while retaining bcrypt hashes.

## Checks

- `npm run build`: production frontend build.
- `npm run lint`: source lint.
- `npm test`: isolated API adapter and session permission checks; no real database.
- `npm audit`: dependency advisory check.

`scripts/test-war-room.mjs` is a destructive event simulation. It requires a
**disposable development database**, `WAR_ROOM_ALLOW_MUTATIONS=1`, and a
`CREDENTIALS_FILE` path to private JSON credentials. It must not run against an
active event database. Its historical changelog results are not current verification.
