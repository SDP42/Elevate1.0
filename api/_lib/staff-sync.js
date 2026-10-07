import { searchParams } from "./http.js";

export async function staffRevision(sql, req, res) {
  const rows = await sql`select domain,version from portal_revisions order by domain`;
  const revision = rows.map(row => String(row.version)).join(":");
  if (searchParams(req).get("since") === revision) {
    res.status(200).json({ unchanged: true, revision });
    return null;
  }
  return revision;
}

// Directory is contact-free. Search happens locally; selection is revalidated
// at lookup/confirmation against the current database roster.
export async function teamDirectory(sql) {
  const rows = await sql`
    select t.id,t.team_code,t.seat_no,a.display_name,
      count(tm.id)::int as total,
      count(rc.member_id)::int as registered
    from teams t join accounts a on a.id=t.account_id
    left join team_members tm on tm.team_id=t.id
    left join registration_checkins rc on rc.member_id=tm.id and rc.team_id=t.id
    where t.withdrawn=false
    group by t.id,a.display_name order by t.seat_no nulls last,t.team_code
  `;
  return rows.map(row => ({id:row.id,teamCode:row.team_code,teamName:row.display_name,seatNo:row.seat_no,total:row.total,registered:row.registered}));
}

// All counts, directory entries and completion status share one SQL snapshot.
export async function mealSnapshot(sql, slotCode) {
  const [snapshot]=await sql`
    with selected_slot as (select id,code,label from meal_slots where code=${slotCode}),
    roster as (
      select t.id,t.team_code,t.seat_no,a.display_name,
        count(tm.id)::int as total,count(rc.member_id)::int as registered
      from teams t join accounts a on a.id=t.account_id
      left join team_members tm on tm.team_id=t.id
      left join registration_checkins rc on rc.member_id=tm.id and rc.team_id=t.id
      where t.withdrawn=false group by t.id,a.display_name
    ), entries as (
      select ml.team_id,tm.id,tm.name,to_jsonb(tm)->>'food_preference' as preference,
        ml.given_at,counter.display_name as counter
      from meal_logs ml join selected_slot s on s.id=ml.meal_slot_id
      join team_members tm on tm.id=ml.member_id and tm.team_id=ml.team_id
      left join accounts counter on counter.id=ml.given_by
    ), complete as (
      select e.team_id from entries e join roster r on r.id=e.team_id
      group by e.team_id,r.total having r.total>0 and count(distinct e.id)=r.total
    ), totals as (
      select ms.id,ms.code,ms.label,ms.day_no,ms.sort_order,count(ml.id)::int as served
      from meal_slots ms left join meal_logs ml on ml.meal_slot_id=ms.id
      group by ms.id
    )
    select
      (select json_build_object('code',code,'label',label) from selected_slot) as slot,
      (select count(*)::int from entries) as served,
      coalesce((select json_agg(json_build_object('id',r.id,'teamCode',r.team_code,'teamName',r.display_name,'seatNo',r.seat_no,'total',r.total,
        'members',(select json_agg(json_build_object('id',e.id,'name',e.name,'foodPreference',e.preference,'givenAt',e.given_at,'counter',e.counter) order by e.given_at desc) from entries e where e.team_id=r.id)) order by r.seat_no nulls last,r.team_code)
        from roster r join complete c on c.team_id=r.id),'[]'::json) as teams,
      coalesce((select json_agg(json_build_object('id',id,'teamCode',team_code,'teamName',display_name,'seatNo',seat_no,'total',total,'registered',registered) order by seat_no nulls last,team_code) from roster),'[]'::json) as directory,
      coalesce((select json_agg(json_build_object('code',code,'label',label,'dayNo',day_no,'served',served) order by sort_order) from totals),'[]'::json) as slots
  `;
  return snapshot;
}
