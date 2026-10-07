import { useState } from "react";

export default function TeamSearch({teams=[],busy,onLookup}) {
  const [name,setName]=useState("");
  const [code,setCode]=useState("");
  const normalize=value=>value.normalize("NFKC").trim().toLowerCase();
  const matches=teams.filter(team=>(!name.trim()||normalize(team.teamName).includes(normalize(name)))&&(!code.trim()||normalize(team.teamCode).includes(normalize(code))));
  const hasInput=Boolean(name.trim()||code.trim());
  const exact=matches.find(team=>normalize(team.teamCode)===normalize(code)) || (matches.length===1?matches[0]:null);
  function choose(team){setName(team.teamName);setCode(team.teamCode);onLookup(team.teamCode);}
  return <form className="portal-manualLookup team-search" onSubmit={event=>{event.preventDefault();if(exact&&!busy)choose(exact);}}>
    <span className="portal-manualLookup__label">Camera not working? Search by team name or code.</span>
    <div className="team-search__fields">
      <label className="portal-field"><span>Team name</span><input value={name} onChange={event=>{setName(event.target.value);setCode("");}} placeholder="Search team name" autoComplete="off" disabled={busy}/></label>
      <label className="portal-field"><span>Team code</span><input value={code} onChange={event=>{setCode(event.target.value);setName("");}} placeholder="e.g. ELEV07" autoComplete="off" disabled={busy}/></label>
      <button type="submit" className="portal-logout" disabled={busy||!exact}>{busy?"Looking up…":"Look up"}</button>
    </div>
    {hasInput&&!busy&&<ul className="team-search__results">
      {matches.slice(0,8).map(team=><li key={team.id}><button type="button" onClick={()=>choose(team)}><span>{team.teamName}</span><strong>{team.teamCode}</strong></button></li>)}
      {matches.length===0&&<li role="status">No matching team. Check the name/code or wait for directory sync.</li>}
      {matches.length>8&&<li>Keep typing to narrow the results.</li>}
    </ul>}
  </form>;
}
