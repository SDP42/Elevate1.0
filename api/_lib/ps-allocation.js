// Serialize the short allocation transactions. READ COMMITTED gives each
// statement a fresh snapshot after the preceding lock has been acquired.
// With 32 teams this avoids cross-team capacity and approval/request races.
export function createPsAllocation(sql) {
  const locked = build => sql.transaction(tx => [
    tx`lock table ps_list, team_ps_selection in share row exclusive mode`,
    ...build(tx),
  ], { isolationLevel: 'ReadCommitted' });
  return {
    async allocatePreferences(teamId, preferences) {
      const [p1,p2,p3,p4] = preferences;
      const results = await locked(tx => [
        tx`select id from teams where id=${teamId} for update`,
        tx`insert into team_ps_preferences(team_id,preference1,preference2,preference3,preference4)
          select t.id, ${p1}, ${p2}, ${p3}, ${p4} from teams t
          where t.id=${teamId} and not t.withdrawn
            and (select count(*) from ps_list where id in (${p1},${p2},${p3},${p4}) and revealed)=4
            and not exists(select 1 from team_ps_selection where team_id=t.id and status='approved')
          on conflict(team_id) do update set preference1=excluded.preference1,preference2=excluded.preference2,
            preference3=excluded.preference3,preference4=excluded.preference4,submitted_at=clock_timestamp()
          returning team_id`,
        tx`insert into team_ps_selection(team_id,ps_id,status,requested_at,approved_at)
          select t.id,p.id,'approved',clock_timestamp(),clock_timestamp()
          from teams t cross join lateral (
            select p.id from ps_list p
            where p.id in (${p1},${p2},${p3},${p4}) and p.revealed
              and (p.capacity is null or (select count(*) from team_ps_selection a where a.ps_id=p.id and a.status='approved') < p.capacity)
            order by case p.id when ${p1} then 1 when ${p2} then 2 when ${p3} then 3 else 4 end limit 1
          ) p where t.id=${teamId} and not t.withdrawn
            and (select count(*) from ps_list where id in (${p1},${p2},${p3},${p4}) and revealed)=4
          on conflict(team_id) do update set ps_id=excluded.ps_id,status='approved',requested_at=excluded.requested_at,
            approved_at=excluded.approved_at,approved_by=null where team_ps_selection.status='pending'
          returning ps_id,status`,
        tx`select ps_id,status from team_ps_selection where team_id=${teamId} and status='approved'`,
      ]);
      return {saved:!!results[2][0],allocated:!!results[3][0],selection:results[4][0]||null};
    },
    async request(teamId, psId) {
      const results = await locked(tx => [
        tx`insert into team_ps_selection (team_id, ps_id, status, requested_at)
          select t.id, p.id, 'pending', clock_timestamp()
          from teams t cross join ps_list p
          where t.id = ${teamId} and not t.withdrawn and p.id = ${psId} and p.revealed
          on conflict (team_id) do update set
            ps_id = excluded.ps_id,
            requested_at = case when team_ps_selection.ps_id = excluded.ps_id then team_ps_selection.requested_at else excluded.requested_at end
          where team_ps_selection.status = 'pending'
          returning ps_id, status`,
      ]);
      return results[1][0] || null;
    },
    async approve(teamId, accountId) {
      const results = await locked(tx => [
        tx`update team_ps_selection s set status = 'approved', approved_at = clock_timestamp(), approved_by = ${accountId}
          from ps_list p, teams t
          where s.team_id = ${teamId} and t.id = s.team_id and not t.withdrawn
            and p.id = s.ps_id and p.revealed and s.status = 'pending'
            and (p.capacity is null or (select count(*) from team_ps_selection a where a.ps_id = p.id and a.status = 'approved') < p.capacity)
            and not exists (select 1 from team_ps_selection q join teams qt on qt.id = q.team_id
              where q.ps_id = s.ps_id and q.status = 'pending' and not qt.withdrawn
              and (q.requested_at, q.team_id) < (s.requested_at, s.team_id))
          returning s.ps_id`,
        tx`select s.ps_id, s.status from team_ps_selection s where s.team_id = ${teamId}`,
      ]);
      return { changed: !!results[1][0], selection: results[2][0] || null };
    },
    async revoke(teamId) {
      await locked(tx => [tx`update team_ps_selection set status = 'pending', approved_at = null, approved_by = null,
        requested_at = clock_timestamp() where team_id = ${teamId} and status = 'approved'`]);
    },
  };
}
