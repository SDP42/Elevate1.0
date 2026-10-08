-- Organizer-approved problem statements. Run explicitly when configuring the
-- event; re-running preserves capacities subsequently adjusted in the backend.
insert into ps_list(code,title,description,capacity,revealed,sort_order) values
 ('EL01','Sports Analytics','NA',8,true,1),
 ('EL02','AI Agents','NA',8,true,2),
 ('EL03','Elevate','NA',8,true,3),
 ('EL04','Obliq','NA',8,true,4)
on conflict(code) do update set title=excluded.title,description=excluded.description,
 revealed=excluded.revealed,sort_order=excluded.sort_order;
update ps_list set revealed=false where code in ('PS1','PS2');
