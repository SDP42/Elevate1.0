-- Display order from the final organizer PDF. Preserve statement IDs, codes,
-- content, capacities, visibility, preferences and existing allocations.
update ps_list
set sort_order = case code
  when 'EL01' then 1
  when 'EL02' then 2
  when 'EL03' then 3
  when 'EL04' then 4
end
where code in ('EL01', 'EL02', 'EL03', 'EL04');
