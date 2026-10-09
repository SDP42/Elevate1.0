import RegistrationHistory from "./RegistrationHistory";
import TeamSearch from "./TeamSearch";
import useStaffSnapshot, { notifyStaffWrite } from "./useStaffSnapshot";
import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import RequireRole from "./RequireRole";
import QrScanner from "./QrScanner";
import { logout, regideskLookup, regideskLookupByCode, regideskSaveMembers } from "./api";

function MemberRow({ member, fields, onChange, disabled }) {
  return <li className="portal-regiRow">
    <div className="portal-regiRow__name">{member.name}{member.isLead && <em>Lead</em>}</div>
    <div className="portal-regiRow__checks">{[
      ['govtIdChecked','Govt ID'],['bagChecked','Bag'],['kitChecked','Kit (notebook, pen, folder)'],['lateArrival','Late arrival']
    ].map(([key,label])=><label key={key} className="portal-regiRow__check">
      <input type="checkbox" disabled={disabled} checked={!!fields[key]} onChange={e=>onChange({...fields,[key]:e.target.checked})} />{label}
    </label>)}</div>
  </li>;
}

function RegiDeskHome({ session }) {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [memberFields, setMemberFields] = useState({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const busyRef = useRef(false);
  const staff = useStaffSnapshot("regidesk");

  const onDecode = useCallback(
    async (payload) => {
      if (busyRef.current || !scanning) return;
      busyRef.current = true;
      setError("");
      try {
        const data = await regideskLookup(payload);
        setResult(data);
        setSelectedMembers([]);
        setMemberFields({});
        setScanning(false);
      } catch (err) {
        setError(err.message);
      } finally {
        busyRef.current = false;
      }
    },
    [scanning]
  );

  async function lookUpManually(manualCode) {
    if (!manualCode.trim() || busyRef.current) return;
    busyRef.current = true;
    setManualBusy(true);
    setError("");
    try {
      const data = await regideskLookupByCode(manualCode.trim());
      setResult(data);
      setSelectedMembers([]);
      setMemberFields({});
      setScanning(false);
    } catch (err) {
      setError(err.message);
    } finally {
      busyRef.current = false;
      setManualBusy(false);
    }
  }

  async function registerSelected() {
    if (busyRef.current || !selectedMembers.length || !result.scanProof) return;
    busyRef.current = true; setSaving(true); setError("");
    try {
      const members=result.members.filter(m=>selectedMembers.includes(m.id)).map(m=>({id:m.id,...(memberFields[m.id] || {govtIdChecked:m.govtIdChecked,bagChecked:m.bagChecked,kitChecked:m.kitChecked,lateArrival:m.lateArrival})}));
      const receipt=await regideskSaveMembers(result.team.id,members,result.scanProof);
      notifyStaffWrite();
      const {registered,total}=receipt.progress;
      setStatus(`${result.team.teamCode}: ${registered} of ${total} registered. ${registered===total?'Whole team registered.':'Look up the same team to register remaining participants.'}`);
      setResult(previous=>({...previous,scanProof:null,progress:receipt.progress,members:previous.members.map(m=>receipt.memberIds.includes(m.id)?{...m,registered:true}:m)}));
      setSelectedMembers([]); setMemberFields({});
    } catch(err) { setError(err.message); }
    finally { busyRef.current=false; setSaving(false); }
  }

  function reset() {
    setResult(null);
    setSelectedMembers([]); setMemberFields({});
    setScanning(true);
  }

  async function onLogout() {
    await logout();
    navigate("/portal/login", { replace: true });
  }

  return (
    <div className="portal-page">
      <div className="portal-page__head">
        <div>
          <span className="portal-page__eyebrow">Elevate 1.0 · Registration Desk</span>
          <h1>{session.displayName}</h1>
        </div>
        <button type="button" className="portal-logout" onClick={onLogout}>
          Log out
        </button>
      </div>

      <section className="portal-card">
        <h3>Check in a team</h3>
        <p className="portal-card__hint">
          Scan a team boarding pass, select everyone present, complete their checks and register them together.
        </p>

        {status && <p className="portal-status" role="status">{status}</p>}
        {error && <p className="portal-auth__error">{error}</p>}

        {scanning ? (
          <>
            <QrScanner onDecode={onDecode} paused={!scanning} />
            <TeamSearch teams={staff.data?.directory} busy={manualBusy} onLookup={lookUpManually} />
          </>
        ) : (
          result && (
            <div className="portal-scanResult">
              <div className="portal-scanResult__header">
                <h4>
                  {result.team.teamName || result.team.displayName || `Team ${result.team.teamCode}`}
                </h4>
                <div className="portal-table__sub" style={{ fontSize: "0.95rem", marginTop: "0.2rem" }}>
                  <strong>{result.team.teamCode}</strong>
                  {result.team.seatNo ? <span> · Seat {result.team.seatNo}</span> : null}
                  {result.team.username ? <span> · <code>{result.team.username}</code></span> : null}
                </div>
              </div>
              <p className="portal-status">{result.progress.registered} of {result.progress.total} registered</p>
              <div className="regi-memberButtons" role="group" aria-label="Participants for this scan">{result.members.map(member=><button type="button" key={member.id} aria-pressed={selectedMembers.includes(member.id)} disabled={saving || member.registered || !result.scanProof} className={member.registered?'is-registered':''} onClick={()=>setSelectedMembers(ids=>ids.includes(member.id)?ids.filter(id=>id!==member.id):[...ids,member.id])}>
                {(member.registered || selectedMembers.includes(member.id)) && <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5Z" /></svg>}
                <span>{member.name}<small>{member.registered?'Registered':selectedMembers.includes(member.id)?'Selected for check-in':'Select participant'}</small></span>
              </button>)}</div>
              {result.progress.registered < result.progress.total && result.scanProof ? <>
                <ul className="portal-regiList portal-u-mt">
                  {result.members.filter(member => selectedMembers.includes(member.id)).map(member =>
                    <MemberRow key={member.id} member={member} disabled={saving} fields={memberFields[member.id] || member} onChange={fields=>setMemberFields(previous=>({...previous,[member.id]:fields}))} />)}
                </ul>
                <button type="button" className="portal-logout portal-u-mt" disabled={saving || !selectedMembers.length} onClick={registerSelected}>{saving ? "Registering…" : `Register ${selectedMembers.length} selected participant${selectedMembers.length===1?'':'s'}`}</button>
              </> : <p className="portal-card__hint">{result.progress.registered===result.progress.total?"Whole team registered.":"Look up the same team to register the remaining participants."}</p>}
              <button type="button" className="portal-logout portal-u-mt" onClick={reset} disabled={saving}>
                Scan another team / remaining participants
              </button>
            </div>
          )
        )}
      </section>
      <RegistrationHistory snapshot={staff} />
    </div>
  );
}

export default function RegiDeskDashboard() {
  return <RequireRole role="regidesk">{(session) => <RegiDeskHome session={session} />}</RequireRole>;
}
