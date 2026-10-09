-- Additive participant profile fields. Drive/ID/payment URLs are not stored.
alter table team_members add column if not exists email text;
alter table team_members add column if not exists phone text;
alter table team_members add column if not exists github_id text;
alter table team_members add column if not exists college text;
alter table team_members add column if not exists year_branch text;
alter table team_members add column if not exists food_preference text;
create table if not exists team_rsvp_details (
  team_id integer primary key references teams(id) on delete cascade,
  source_row integer not null,
  source_hash text not null,
  responded_at timestamptz,
  respondent_email text,
  declared_size integer not null check (declared_size between 2 and 4),
  attending boolean not null,
  payment_payers jsonb not null default '[]'::jsonb,
  terms_confirmation text,
  declaration text,
  imported_at timestamptz not null default now()
);

create index if not exists meal_logs_slot_time_idx on meal_logs (meal_slot_id, given_at desc);
create index if not exists meal_logs_team_receipt_idx on meal_logs (team_id, id desc);

-- One successful registration or meal redemption per accepted team QR scan.
alter table meal_logs add column if not exists scan_id text;
alter table registration_checkins add column if not exists scan_id text;
create unique index if not exists meal_logs_scan_id_key on meal_logs (scan_id) where scan_id is not null;
create unique index if not exists registration_checkins_scan_id_key on registration_checkins (scan_id) where scan_id is not null;

-- Login comparisons are case insensitive; prevent case-only duplicates.
create unique index if not exists accounts_username_lower_unique on accounts (lower(username));
