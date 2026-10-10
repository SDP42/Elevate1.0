-- Organizer-approved problem statements. Run explicitly when configuring the
-- event; re-running preserves capacities subsequently adjusted in the backend.
insert into ps_list(code,title,description,capacity,revealed,sort_order) values
 ('EL01','Intelligent Aviation Experience','Aviation, Travel Planning, Mobile UX, Multilingual AI, Offline AI',8,true,1),
 ('EL02','Racket Sports Intelligence','Computer Vision, Sports Analytics, Player Performance, Community Platforms',8,true,2),
 ('EL03','Agentic ML Research','Multi-Agent Systems, Machine Learning, Research Automation, Experimentation',8,true,3),
 ('EL04','AI Revenue Auditing','Revenue Auditing, Accounting, Fraud Detection, MCP, Explainable AI',8,true,4)
on conflict(code) do update set title=excluded.title,description=excluded.description,
 revealed=excluded.revealed,sort_order=excluded.sort_order;
-- Retire legacy demos only when no team data references them.
delete from ps_list p where p.code in ('PS1','PS2')
  and not exists(select 1 from team_ps_selection s where s.ps_id=p.id)
  and not exists(select 1 from team_ps_preferences f
    where p.id in (f.preference1,f.preference2,f.preference3,f.preference4));
