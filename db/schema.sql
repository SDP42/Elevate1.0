-- Elevate 1.0 — participant portal schema.
-- Full schema is created now (Phase 1) even though only accounts, teams,
-- team_members and the QR token are used yet, so later phases (marks,
-- meals, PS selection) are migrations-free — just new application code
-- against tables that already exist.

create extension if not exists pgcrypto;

-- one row per login: every team, every core/admin/meal/regidesk staff member.
create table if not exists accounts (
  id serial primary key,
  username text unique not null,
  password_hash text not null,
  role text not null check (role in ('admin', 'core', 'meal', 'team', 'regidesk')),
  display_name text not null,
  created_at timestamptz not null default now()
);

-- widen the role check to include regidesk, added after the original launch
-- (a 'volunteer' role briefly existed here too, then was removed as unneeded)
alter table accounts drop constraint if exists accounts_role_check;
alter table accounts add constraint accounts_role_check
  check (role in ('admin', 'core', 'meal', 'team', 'regidesk'));

alter table accounts add column if not exists initial_password text;

-- a team's own profile, one-to-one with its 'team' account.
create table if not exists teams (
  id serial primary key,
  account_id integer not null unique references accounts(id) on delete cascade,
  team_code text unique not null,          -- e.g. "T1"
  seat_no integer,
  qr_token text unique,                    -- opaque random string encoded in the QR (null until shortlisted)
  created_at timestamptz not null default now()
);

alter table teams alter column qr_token drop not null;

alter table teams add column if not exists dietary text;
alter table teams add column if not exists shortlisted boolean not null default false;
alter table teams add column if not exists submission_url text;
alter table teams add column if not exists submission_note text;
alter table teams add column if not exists submitted_at timestamptz;
-- a team that drops out overnight — excluded from the leaderboard and its
-- approved PS seat freed, without deleting any of their history
alter table teams add column if not exists withdrawn boolean not null default false;

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

-- a team's PS pick is a *request* first — first come, first served by
-- requested_at — and only becomes official once admin approves it.
-- "status" here, not a separate table, is what every team's dashboard
-- checks to show a live allocation board.
create table if not exists team_ps_selection (
  team_id integer primary key references teams(id) on delete cascade,
  ps_id integer not null references ps_list(id),
  status text not null default 'pending' check (status in ('pending', 'approved')),
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by integer references accounts(id)
);

alter table team_ps_selection add column if not exists status text not null default 'pending';
alter table team_ps_selection drop constraint if exists team_ps_selection_status_check;
alter table team_ps_selection add constraint team_ps_selection_status_check
  check (status in ('pending', 'approved'));
alter table team_ps_selection add column if not exists approved_at timestamptz;
alter table team_ps_selection add column if not exists approved_by integer references accounts(id);
alter table team_ps_selection drop constraint if exists team_ps_selection_ps_id_fkey;
alter table team_ps_selection add constraint team_ps_selection_ps_id_fkey
  foreign key (ps_id) references ps_list(id) on delete cascade;

-- the table used to be keyed just by team_id with a "selected_at" column;
-- rename it to requested_at to match the request/approve model, if it's
-- still around under its old name from before this change.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'team_ps_selection' and column_name = 'selected_at'
  ) then
    alter table team_ps_selection rename column selected_at to requested_at;
  end if;
end $$;

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
alter table marks add column if not exists feedback text;

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

-- which teams a core account is responsible for judging. A core account
-- with no rows here sees every team (the default, unassigned state) —
-- assigning only kicks in once an admin actually narrows someone down.
-- slot_time is an optional mentoring time slot, set alongside the
-- assignment itself (e.g. "10:00 AM") so mentors don't all descend on
-- every team at once.
create table if not exists core_assignments (
  core_account_id integer not null references accounts(id) on delete cascade,
  team_id integer not null references teams(id) on delete cascade,
  slot_time text,
  primary key (core_account_id, team_id)
);
alter table core_assignments add column if not exists slot_time text;

-- a core account recusing themselves from a specific team (conflict of
-- interest) — independent of core_assignments, so recusing one team never
-- flips an otherwise-unassigned mentor into "only sees this one team" mode.
create table if not exists core_recusals (
  core_account_id integer not null references accounts(id) on delete cascade,
  team_id integer not null references teams(id) on delete cascade,
  primary key (core_account_id, team_id)
);

-- Round 1 doesn't carry marks, but core/admin can still leave a
-- shortlisting note against a team from the online round.
create table if not exists round1_notes (
  id serial primary key,
  team_id integer not null references teams(id) on delete cascade,
  note text not null,
  entered_by integer references accounts(id),
  entered_at timestamptz not null default now()
);

-- door / venue check-in on event day — separate from meals, one row per
-- member for the whole event rather than per slot.
create table if not exists event_checkins (
  id serial primary key,
  team_id integer not null references teams(id) on delete cascade,
  member_id integer not null references team_members(id) on delete cascade,
  checked_in_by integer references accounts(id),
  checked_in_at timestamptz not null default now(),
  unique (member_id)
);

-- registration desk, on event day: per-member verification (government ID,
-- bag, ideation kit) plus a GitHub handle collected at the door — one row
-- per member, updatable (a team walking up incomplete can be completed
-- later without re-creating the row).
create table if not exists registration_checkins (
  member_id integer primary key references team_members(id) on delete cascade,
  team_id integer not null references teams(id) on delete cascade,
  github_id text,
  govt_id_checked boolean not null default false,
  bag_checked boolean not null default false,
  kit_checked boolean not null default false,
  medical_note text,
  late_arrival boolean not null default false,
  notes text,
  checked_in_by integer references accounts(id),
  checked_in_at timestamptz not null default now()
);
alter table registration_checkins add column if not exists kit_checked boolean not null default false;
alter table registration_checkins add column if not exists medical_note text;
alter table registration_checkins add column if not exists late_arrival boolean not null default false;

-- short admin-authored notices, read by every logged-in role (shown on
-- the team dashboard, but available to any role that wants to check).
-- pinned ones are shown first, visually distinct — fire-alarm-test /
-- schedule-change territory, not routine chatter.
create table if not exists announcements (
  id serial primary key,
  message text not null,
  active boolean not null default true,
  pinned boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table announcements add column if not exists pinned boolean not null default false;

-- real-world incidents and requests raised on event day — a team's SOS, a
-- meal counter flagging low stock, registration logging a guest who
-- isn't on the roster — separate from audit_log (which is just a trail of
-- system actions), so organisers have one place to see what needs
-- attention right now.
create table if not exists incidents (
  id serial primary key,
  type text not null check (type in ('sos', 'low_stock', 'guest', 'late_arrival', 'other')),
  team_id integer references teams(id) on delete cascade,
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_by integer references accounts(id),
  created_role text,
  resolved_by integer references accounts(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- a tiny generic key/value store for event-wide toggles — currently just
-- whether the leaderboard has been frozen for the final results reveal.
create table if not exists settings (
  key text primary key,
  value jsonb
);

-- failed login attempts, per username — login() checks and prunes this on
-- every call, so a wrong password repeatedly thrown at one account locks
-- it out for a short cooldown instead of being retryable forever. Never
-- grows unbounded: old rows are deleted as part of the same check.
create table if not exists login_attempts (
  id serial primary key,
  username text not null,
  attempted_at timestamptz not null default now()
);
create index if not exists login_attempts_username_idx on login_attempts (username, attempted_at);

-- a plain trail of who did what, for settling disputes on the day —
-- written alongside the actions that actually matter (marks, meals,
-- check-ins, roster/PS/shortlist changes), never read by application
-- logic itself.
create table if not exists audit_log (
  id serial primary key,
  actor_account_id integer references accounts(id),
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
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
