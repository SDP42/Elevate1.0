// One database snapshot supplies roster, scans, preferences and counter history.
export async function mealAnalysis(sql, slotCode) {
  const rows = await sql`
    select s.code, s.label, s.day_no, t.id as team_id, t.team_code, t.seat_no, t.withdrawn,
      a.display_name as team_name, tm.id as member_id, tm.name, tm.is_lead,
      to_jsonb(tm)->>'food_preference' as preference,
      ml.id as scan_id, ml.given_at, counter.display_name as counter
    from meal_slots s
    left join teams t on true
    left join accounts a on a.id = t.account_id
    left join team_members tm on tm.team_id = t.id
    left join meal_logs ml on ml.meal_slot_id = s.id and ml.member_id = tm.id and ml.team_id = t.id
    left join accounts counter on counter.id = ml.given_by
    where s.code = ${slotCode}
    order by t.seat_no nulls last, t.team_code, tm.sort_order, tm.id
  `;
  if (!rows.length) return null;
  const teams = new Map();
  for (const row of rows) {
    if (!row.team_id) continue;
    if (!teams.has(row.team_id)) teams.set(row.team_id, { id: row.team_id, teamCode: row.team_code,
      teamName: row.team_name, seatNo: row.seat_no, withdrawn: row.withdrawn, members: [] });
    if (row.member_id) teams.get(row.team_id).members.push({ id: row.member_id, name: row.name,
      isLead: row.is_lead, foodPreference: row.preference || 'Unspecified',
      served: row.scan_id != null, givenAt: row.given_at, counter: row.counter });
  }
  const roster = [...teams.values()].map(team => ({ ...team, total: team.members.length,
    served: team.members.filter(member => member.served).length }));
  const active = roster.filter(team => !team.withdrawn);
  const members = active.flatMap(team => team.members);
  const diets = {};
  const counters = {};
  for (const member of members) {
    const diet = diets[member.foodPreference] ||= { total: 0, served: 0 };
    diet.total++;
    if (member.served) {
      diet.served++;
      const name = member.counter || 'Meal counter';
      counters[name] = (counters[name] || 0) + 1;
    }
  }
  return { slot: { code: rows[0].code, label: rows[0].label, dayNo: rows[0].day_no },
    teams: roster, summary: { total: members.length, served: members.filter(m => m.served).length,
      completeTeams: active.filter(t => t.total > 0 && t.served === t.total).length,
      partialTeams: active.filter(t => t.served > 0 && t.served < t.total).length,
      waitingTeams: active.filter(t => t.served === 0).length, diets, counters } };
}
