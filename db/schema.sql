-- Elevate 1.0 — participant portal schema.
-- Full schema is created now (Phase 1) even though only accounts, teams,
-- team_members and the QR token are used yet, so later phases (marks,
-- meals, PS selection) are migrations-free — just new application code
-- against tables that already exist.

create extension if not exists pgcrypto;

-- one row per login: every team, every core/admin/meal staff member.
create table if not exists accounts (
  id serial primary key,
  username text unique not null,
  password_hash text not null,
  role text not null check (role in ('admin', 'core', 'meal', 'team')),
  display_name text not null,
  created_at timestamptz not null default now()
);

-- a team's own profile, one-to-one with its 'team' account.
create table if not exists teams (
  id serial primary key,
  account_id integer not null unique references accounts(id) on delete cascade,
  team_code text unique not null,          -- e.g. "T1"
  seat_no integer,
  qr_token text unique not null,           -- opaque random string encoded in the QR
  created_at timestamptz not null default now()
);

create table if not exists team_members (
  id serial primary key,
  team_id integer not null references teams(id) on delete cascade,
  name text not null,
  is_lead boolean not null default false,
  sort_order integer not null default 0
);

-- problem statements — hidden (revealed = false) until organisers switch it on.
create table if not exists ps_list (
  id serial primary key,
  code text unique not null,
  title text not null,
  description text,
  capacity integer,
  revealed boolean not null default false,
  sort_order integer not null default 0
);

create table if not exists team_ps_selection (
  team_id integer primary key references teams(id) on delete cascade,
  ps_id integer not null references ps_list(id),
  selected_at timestamptz not null default now()
);

-- round 1 is the online PS round (no marks); round 2 is the on-campus
-- mentoring round that does carry marks, per the brief.
create table if not exists mentoring_rounds (
  id serial primary key,
  round_no integer not null unique,
  label text not null,
  carries_marks boolean not null default false
);

create table if not exists marks (
  id serial primary key,
  team_id integer not null references teams(id) on delete cascade,
  round_id integer not null references mentoring_rounds(id),
  score numeric not null,          -- the total — sum of criteria, kept as
                                    -- its own column so the leaderboard and
                                    -- older code never need to know the
                                    -- rubric shape
  criteria jsonb,                  -- { "innovation": 20, "technical": 22, ... } — see shared/criteria.js
  entered_by integer references accounts(id),
  entered_at timestamptz not null default now(),
  unique (team_id, round_id)
);

alter table marks add column if not exists criteria jsonb;

-- the 7 meal slots across the two event days.
create table if not exists meal_slots (
  id serial primary key,
  code text unique not null,               -- e.g. "d1_breakfast"
  label text not null,
  day_no integer not null,                 -- 1 or 2
  sort_order integer not null default 0
);

-- one row per member actually served at a given slot.
create table if not exists meal_logs (
  id serial primary key,
  team_id integer not null references teams(id) on delete cascade,
  member_id integer not null references team_members(id) on delete cascade,
  meal_slot_id integer not null references meal_slots(id),
  given_by integer references accounts(id),
  given_at timestamptz not null default now(),
  unique (member_id, meal_slot_id)
);

insert into mentoring_rounds (round_no, label, carries_marks) values
  (1, 'Round 1 — Online PS round', false),
  (2, 'Round 2 — On-campus mentoring', true)
on conflict (round_no) do nothing;

insert into meal_slots (code, label, day_no, sort_order) values
  ('d1_breakfast', 'Breakfast', 1, 1),
  ('d1_lunch', 'Lunch', 1, 2),
  ('d1_evening_snacks', 'Evening snacks', 1, 3),
  ('d1_dinner', 'Dinner', 1, 4),
  ('d1_midnight_snacks', 'Midnight snacks', 1, 5),
  ('d2_breakfast', 'Breakfast', 2, 6),
  ('d2_lunch', 'Lunch', 2, 7)
on conflict (code) do nothing;
