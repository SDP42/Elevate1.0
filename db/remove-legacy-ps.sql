-- Explicit, idempotent cleanup of the two obsolete demonstration statements.
-- Abort rather than cascading away any team's assignment or preferences.
do $$
begin
  lock table ps_list, team_ps_selection, team_ps_preferences in share row exclusive mode;
  if exists (
    select 1 from ps_list p where p.code in ('PS1','PS2') and (
      exists(select 1 from team_ps_selection s where s.ps_id=p.id) or
      exists(select 1 from team_ps_preferences f
        where p.id in (f.preference1,f.preference2,f.preference3,f.preference4))
    )
  ) then
    raise exception 'Legacy PS cleanup aborted: team selections or preferences still reference PS1/PS2';
  end if;
  delete from ps_list where code in ('PS1','PS2');
end $$;
