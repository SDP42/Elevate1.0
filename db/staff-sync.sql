-- Transactional change markers: idle staff tabs read three small rows rather
-- than repeatedly downloading rosters and meal histories. Existing data stays.
create table if not exists portal_revisions (
  domain text primary key check (domain in ('meals','registration','roster')),
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into portal_revisions (domain) values ('meals'),('registration'),('roster') on conflict do nothing;
create or replace function bump_portal_revision() returns trigger language plpgsql as $$
begin
  update portal_revisions set version=version+1,updated_at=now() where domain=TG_ARGV[0];
  return null;
end;
$$;
drop trigger if exists meal_revision on meal_logs;
create trigger meal_revision after insert or update or delete on meal_logs for each row execute function bump_portal_revision('meals');
drop trigger if exists registration_revision on registration_checkins;
create trigger registration_revision after insert or update or delete on registration_checkins for each row execute function bump_portal_revision('registration');
drop trigger if exists roster_member_revision on team_members;
create trigger roster_member_revision after insert or update or delete on team_members for each row execute function bump_portal_revision('roster');
drop trigger if exists roster_team_revision on teams;
create trigger roster_team_revision after insert or update or delete on teams for each row execute function bump_portal_revision('roster');
drop trigger if exists roster_account_revision on accounts;
create trigger roster_account_revision after insert or update or delete on accounts for each row execute function bump_portal_revision('roster');
create index if not exists registration_team_idx on registration_checkins (team_id,member_id);
create index if not exists team_members_team_idx on team_members (team_id,sort_order);
