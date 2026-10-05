# Portal database and login setup

The API uses `@neondatabase/serverless` over Neon's HTTP transport. A normal
local PostgreSQL server requires a separate transport adapter; it is not
supported by the current connection module.

1. Create a dedicated Neon development database or use an existing configured
   database. Put its connection string in an ignored `.env` as `DATABASE_URL`.
2. Set `SESSION_SECRET` to a long random value in the same file. Use
   `openssl rand -base64 48` for a new local environment. Set file permissions
   with `chmod 600 .env`. Keep credentials out of browser code and Git.
3. For a fresh database, run `npm run db:migrate` to create tables. For an
   existing database, review `schema.sql` before applying schema changes.
   The feedback approval feature needs:
   ```sql
   alter table marks add column if not exists feedback_approved boolean not null default false;
   ```
4. Fresh development accounts can be added with `npm run db:seed`. It creates
   only missing usernames and preserves existing accounts, passwords, rosters
   and event history. A private JSON archive can be supplied with
   `npm run db:seed -- --credentials-file /absolute/private/accounts.json`.
   Newly generated credentials are written privately to
   `db/credentials.generated.json`. Accounts present in the database are not
   reset to the passwords in the supplied file.
5. Run `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort` and visit
   http://127.0.0.1:5173/portal/login. Vite serves both the frontend and API.

Default demo usernames are `team01`–`team35`, `core01`–`core05`,
`admin01`–`admin02`, `meal01`–`meal03`, and `regidesk01`–`regidesk03`.
Passwords are individually assigned; the API stores only bcrypt hashes.
Super-admin uses the separate `superadmin` identity. Its creation/reset script
requires `SUPERADMIN_PASSWORD` and must only run when that reset is intended.

The role buttons on the login form are guidance. The server determines the
role from the matching account, then returns its dashboard. Team renaming
preserves issued usernames so distributed credentials continue to work.
