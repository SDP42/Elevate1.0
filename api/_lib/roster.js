function rosterConflict(message) { return Object.assign(new Error(message), { code: "ROSTER_CONFLICT" }); }

// Roster edits preserve member IDs and imported profile fields. Removing a
// served/registered participant or replacing an imported identity is refused.
export async function saveRoster(sql, teamId, names) {
  const roster = await sql`select tm.*, to_jsonb(tm)->>'email' as profile_email,
    to_jsonb(tm)->>'food_preference' as profile_food from team_members tm where team_id=${teamId} order by sort_order,id`;
  const sameName = (a,b) => a.trim().toLowerCase().replace(/\s+/g," ") === b.trim().toLowerCase().replace(/\s+/g," ");
  for (let i=0;i<Math.min(names.length,roster.length);i++) {
    if ((roster[i].profile_email || roster[i].profile_food) && !sameName(names[i],roster[i].name)) {
      throw rosterConflict("This roster has imported participant profiles. Reconcile identity changes through the RSVP import.");
    }
  }
  const removed = roster.slice(names.length).map(m => m.id);
  const changed = roster.filter((m,i) => i < names.length && !sameName(m.name,names[i])).map(m => m.id);
  const guarded = [...removed,...changed];
  const history = await sql`select member_id from meal_logs where member_id=any(${guarded}::int[])
    union select member_id from registration_checkins where member_id=any(${guarded}::int[])
    union select member_id from event_checkins where member_id=any(${guarded}::int[])`;
  if(history.length) throw rosterConflict("A participant being changed has registration or meal history. Reconcile that record first.");
  const ids = roster.map(m => m.id);
  const writes = [sql`select id from team_members where id=any(${ids}::int[]) for update`,
    sql`select 1 / case when not exists (
      select 1 from meal_logs where member_id=any(${guarded}::int[])
      union all select 1 from registration_checkins where member_id=any(${guarded}::int[])
      union all select 1 from event_checkins where member_id=any(${guarded}::int[])
    ) then 1 else 0 end as safe_roster_update`];
  names.forEach((name,i) => {
    if(roster[i]) writes.push(sql`update team_members set name=${name},is_lead=${i===0},sort_order=${i+1} where id=${roster[i].id} and team_id=${teamId}`);
    else writes.push(sql`insert into team_members (team_id,name,is_lead,sort_order) values (${teamId},${name},${i===0},${i+1})`);
  });
  if(removed.length) writes.push(sql`delete from team_members where id=any(${removed}::int[]) and team_id=${teamId}`);
  await sql.transaction(writes);
}
