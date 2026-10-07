import StaffGlass from "./StaffGlass";

export default function RegistrationHistory({snapshot}) {
  const registered=(snapshot.data?.directory||[]).filter(team=>team.registered>0);
  return <StaffGlass label="Registered teams">
    <h3>Registered teams</h3>
    <p className="portal-card__hint">One accepted scan per participant. Live progress is based on saved check-ins.</p>
    {snapshot.error&&<p role="status" className="portal-auth__error">{snapshot.error}</p>}
    {!snapshot.data&&<p role="status">Loading teams…</p>}
    {snapshot.data&&registered.length===0&&<p className="portal-card__hint">No teams registered yet.</p>}
    <div className="meal-history__teams">{registered.map(team=><article className="meal-history__team" key={team.id}>
      <h4>{team.teamName}</h4><p>{team.teamCode}{team.seatNo!=null?` · Seat ${team.seatNo}`:""}</p>
      <div className="staff-progress"><progress value={team.registered} max={Math.max(1,team.total)}/><span>{team.registered} / {team.total} registered{team.registered===team.total?" · Complete":""}</span></div>
    </article>)}</div>
  </StaffGlass>;
}
