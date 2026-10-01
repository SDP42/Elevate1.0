# Portal setup — Phase 1 (login, team accounts, QR boarding pass)

This gets you: 35 team accounts, 5 core accounts, 2 admin accounts, 3 meal
accounts, each team's boarding pass with a QR code and their member names,
and an admin page that lists every team and account straight from the
database — so you don't need a separate database tool to see what's in it.

Not in this phase yet (next phases, once this is working): PS selection,
QR scanning at meals, marks entry, the leaderboard.

## 1. Create the database

Vercel's own Postgres is now a Neon-backed integration:

1. Open your project on [vercel.com](https://vercel.com) → **Storage** tab.
2. **Create Database** → **Postgres** (via Neon) → pick a region close to
   Mumbai → create.
3. Vercel will offer to connect it to this project. Say yes — this
   automatically adds a `DATABASE_URL` environment variable to your Vercel
   project for you.

## 2. Get the connection string locally

1. In the same Storage tab, open your new database → **.env.local** tab →
   copy the `DATABASE_URL` value.
2. In this repo, copy `.env.example` to `.env` and paste it in:
   ```bash
   cp .env.example .env
   ```
3. Generate a session secret and put it in `.env` too:
   ```bash
   openssl rand -base64 48
   ```
   (Any long random string works if you don't have `openssl` — a password
   manager's "generate password" at max length is fine too.)

## 3. Create the tables

```bash
npm run db:migrate
```

Safe to run more than once — every statement is written so re-running it
doesn't duplicate or wipe anything.

## 4. Seed the accounts

```bash
npm run db:seed
```

This prints every username/password once in your terminal, and also saves
them to `db/credentials.generated.json` (already in `.gitignore` — it never
gets committed, so keep that file somewhere safe, like a password manager
or a private sheet you control). The database itself only ever stores a
bcrypt hash — there's no way to read a password back out of it later, so if
you lose that file, the only fix is re-running the seed for that one
account (it's safe to re-run for everyone; existing passwords just get
replaced for whoever you re-seed).

Usernames follow a fixed pattern:
- Teams: `team01` … `team35`
- Core: `core01` … `core05`
- Admin: `admin01`, `admin02`
- Meal: `meal01` … `meal03`

Each team's placeholder roster is named `T<n>M1` … `T<n>M4` for now — swap
in real names (from your Unstop export) straight in the database once
you have them; there's no reseed needed for that, just an update to each
`team_members` row. I can wire up a small admin "edit roster" page for that
in the next phase if you'd rather not touch the database directly.

## 5. Run it locally

The portal's `/api/*` functions are Vercel serverless functions — `vite
dev` alone won't run them. Use the Vercel CLI instead, which runs both the
frontend and the API functions together:

```bash
npx vercel dev
```

First run will ask you to link the project to your Vercel account/project
— say yes, pick the existing project. It reads `.env` automatically. Then
visit `http://localhost:3000/portal/login`.

## 6. Deploy

Push to your connected Git branch as usual, or `npx vercel --prod`. Vercel
already has `DATABASE_URL` from step 1 — just add `SESSION_SECRET` under
**Settings → Environment Variables** on vercel.com (the same value you put
in `.env`, or a fresh one — either way, pick one value and use it
everywhere this app runs).

## Seeing the data

Two ways, both already set up:

- **In the app**: log in as `admin01`, and the admin dashboard lists every
  team (with its roster) and every staff account, read straight from the
  database.
- **Raw SQL, if you ever need it**: Storage tab → your database → **Query**
  — Neon's own console, for anything the admin page doesn't show yet.
