-- Enforce the same roster ownership checks at the database boundary.
-- Validate existing rows; never delete or silently reassign scan history.
create unique index if not exists team_members_id_team_unique on team_members (id,team_id);
do $$
begin
  if not exists(select 1 from pg_constraint where conname='meal_member_team_fk' and conrelid='meal_logs'::regclass) then
    alter table meal_logs add constraint meal_member_team_fk foreign key (member_id,team_id) references team_members(id,team_id) on delete cascade not valid;
  end if;
  if not exists(select 1 from pg_constraint where conname='registration_member_team_fk' and conrelid='registration_checkins'::regclass) then
    alter table registration_checkins add constraint registration_member_team_fk foreign key (member_id,team_id) references team_members(id,team_id) on delete cascade not valid;
  end if;
end;
$$;
alter table meal_logs validate constraint meal_member_team_fk;
alter table registration_checkins validate constraint registration_member_team_fk;
