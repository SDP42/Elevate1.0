// Serialize the short allocation transactions. READ COMMITTED gives each
// statement a fresh snapshot after the preceding lock has been acquired.
// With 32 teams this avoids cross-team capacity and approval/request races.
export function createPsAllocation(sql) {
  const locked = build => sql.transaction(tx => [
    tx`lock table ps_list, team_ps_selection in share row exclusive mode`,
    ...build(tx),
  ], { isolationLevel: 'ReadCommitted' });
  return {
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
