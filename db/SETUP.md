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

Default demo usernames are `ELEV01`–`ELEV32`, `core01`–`core05`,
`admin01`–`admin02`, `meal01`–`meal03`, and `regidesk01`–`regidesk03`.
Passwords are individually assigned; the API stores only bcrypt hashes.
Super-admin uses the separate `superadmin` identity. Its creation/reset script
requires `SUPERADMIN_PASSWORD` and must only run when that reset is intended.

The role buttons on the login form are guidance. The server determines the
role from the matching account, then returns its dashboard. Login is case insensitive.
Existing team accounts use the reviewed `db/team-identities.mjs` migration to
change both username and displayed code without changing passwords or QR tokens. Team renaming
preserves issued usernames so distributed credentials continue to work.

### Participant document submissions

`db/submission-files.sql` is an additive migration (also included in `schema.sql`).
It creates `submission_files` with the original bytes in Postgres `bytea` and
filename, format, size, team ID, and upload time. There is one slot per team per
format: PDF, PPTX, MD, TXT. A replacement changes only that slot; existing links,
notes, rosters, and ticket details are preserved. Each file is limited to 3 MiB
so its JSON upload stays within the serverless request limit. File access requires
the owning team session or an admin/superadmin session. Payloads are not returned
by the team list and are fetched only when opening a preview.

Markdown is rendered as formatted content with raw HTML disabled; text is shown
as plain text; PDFs use PDF.js page navigation. PPTX previews show slide text and
embedded raster images; download the original for complete PowerPoint layout,
charts, and animation fidelity. Previewing a document never uploads it to an
external conversion service.

`HELP_CONTACTS` in `src/config.js` configures public organiser WhatsApp recipients
with `{ name, phone }` entries. Use country code plus digits. The Help card opens
`wa.me` with team, seat, and message prefilled; the participant must tap Send in
WhatsApp. No WhatsApp Business API keys are needed. The button stays disabled
until a recipient is configured.

### Staff scanner data

Existing databases need the additive `participant-details.sql`, `staff-sync.sql`
and `scan-integrity.sql` migrations. Take a private backup and apply them in one
transaction. Integrity validation fails instead of silently deleting mismatched
records. Fresh databases receive these changes through `schema.sql`. Staff
search/history share a cached snapshot; lookups and confirmations always
revalidate current database state. See `RSVP-IMPORT.md` for event operation.

### Problem statement capacities

The admin PS form accepts only code/title and reveal/hide actions. New entries
start at capacity **0** (no approvals) until configured in PostgreSQL. Updating
code/title or reveal status preserves the existing backend capacity. Description
is not displayed to participants. Configure each cap directly, for example:

```sql
UPDATE ps_list SET capacity = 4 WHERE code = 'PS1';
```

Use a nonnegative integer, or NULL for unlimited. Do not lower a capacity below
the already approved team count. Pending requests do not reserve capacity.
Approvals enforce request order within each PS (timestamp, then team ID), and
only revealed PS entries for active teams can be approved. Revocation moves the
team to the end of the pending queue. Duplicate requests preserve queue position.
Short transactions lock the PS/selection tables before reading or writing;
READ COMMITTED ensures a waiting transaction sees the previous commit. This
serializes concurrent requests and approvals without exceeding configured caps.
No migration or production capacity changes are required for this update.

Run the isolated 32-team concurrency check without loading .env:

```sh
node scripts/verify-ps-postgres.mjs
```

It requires local PostgreSQL tools and uses a temporary database that is removed
on completion. Visible participant/request screens refresh every five seconds;
a successful action refreshes immediately. Hidden tabs pause polling.
