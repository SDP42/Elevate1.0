import RegistrationHistory from "./RegistrationHistory";
import TeamSearch from "./TeamSearch";
import useStaffSnapshot, { notifyStaffWrite } from "./useStaffSnapshot";
import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import RequireRole from "./RequireRole";
import QrScanner from "./QrScanner";
import { logout, regideskLookup, regideskLookupByCode, regideskSave } from "./api";

function MemberRow({ member, teamId, scanProof, onSaved }) {
  const [githubId, setGithubId] = useState(member.githubId);
  const [govtIdChecked, setGovtIdChecked] = useState(member.govtIdChecked);
  const [bagChecked, setBagChecked] = useState(member.bagChecked);
  const [kitChecked, setKitChecked] = useState(member.kitChecked);
  const [medicalNote, setMedicalNote] = useState(member.medicalNote);
  const [lateArrival, setLateArrival] = useState(member.lateArrival);
  const [notes, setNotes] = useState(member.notes);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const fields = { githubId, govtIdChecked, bagChecked, kitChecked, medicalNote, lateArrival, notes };

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const receipt = await regideskSave(member.id, teamId, { ...fields, scanProof });
      setSaved(true);
      onSaved(receipt);
    } catch (error) { setError(error.message); } finally {
      setSaving(false);
    }
  }

  function check(setter) {
    return (e) => {
      setter(e.target.checked);
      setSaved(false);
    };
  }

  function text(setter) {
    return (e) => {
      setter(e.target.value);
      setSaved(false);
    };
  }

  return (
    <li className="portal-regiRow">
      <div className="portal-regiRow__name">
        {member.name}
        {member.isLead && <em>Lead</em>}
        {member.foodPreference && <span className="meal-diet">{member.foodPreference}</span>}
      </div>

      <div className="portal-regiRow__checks">
        <label className="portal-regiRow__check">
          <input type="checkbox" checked={govtIdChecked} onChange={check(setGovtIdChecked)} />
          Govt ID
        </label>
        <label className="portal-regiRow__check">
          <input type="checkbox" checked={bagChecked} onChange={check(setBagChecked)} />
          Bag
        </label>
        <label className="portal-regiRow__check">
          <input type="checkbox" checked={kitChecked} onChange={check(setKitChecked)} />
          Kit (notebook, pen, folder)
        </label>
        <label className="portal-regiRow__check portal-regiRow__check--warn">
          <input type="checkbox" checked={lateArrival} onChange={check(setLateArrival)} />
          Late arrival
        </label>
      </div>

      <div className="portal-regiRow__fields">
        <label className="portal-regiRow__field">
          <span>GitHub ID</span>
          <input value={githubId} onChange={text(setGithubId)} placeholder="username" />
        </label>
        <label className="portal-regiRow__field">
          <span>Medical note</span>
          <input value={medicalNote} onChange={text(setMedicalNote)} placeholder="Allergies, conditions, emergency contact…" />
        </label>
        <label className="portal-regiRow__field">
          <span>Notes</span>
          <input value={notes} onChange={text(setNotes)} placeholder="Optional" />
        </label>
      </div>

      {error && <p role="alert" className="portal-auth__error">{error}</p>}
      <button type="button" className="portal-logout portal-regiRow__save" onClick={save} disabled={saving}>
        {saving ? "Saving…" : saved ? "Saved ✓" : "Register this scan"}
      </button>
    </li>
  );
}

function RegiDeskHome({ session }) {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
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
        setSelectedMember(data.members.find(m => !m.registered)?.id || null);
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
      setSelectedMember(data.members.find(m => !m.registered)?.id || null);
      setScanning(false);
    } catch (err) {
      setError(err.message);
    } finally {
      busyRef.current = false;
      setManualBusy(false);
    }
  }

  function onMemberSaved(receipt) {
    notifyStaffWrite();
    const { registered, total } = receipt.progress;
    setStatus(`${result.team.teamCode}: ${registered} of ${total} registered. ${registered === total ? "Whole team registered." : "Scan the same team QR for the next participant."}`);
    reset();
  }

  function reset() {
    setResult(null);
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
          Scan the same team boarding pass once for each participant. Each scan registers one person after their ID and kit checks.
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
              {result.progress.registered < result.progress.total ? <>
                <label className="portal-field portal-u-mt"><span>Participant for this scan</span>
                  <select value={selectedMember || ""} onChange={event => setSelectedMember(Number(event.target.value))}>
                    {result.members.filter(member => !member.registered).map(member => <option key={member.id} value={member.id}>{member.name}{member.foodPreference ? ` · ${member.foodPreference}` : ""}</option>)}
                  </select>
                </label>
                <ul className="portal-regiList portal-u-mt">
                  {result.members.filter(member => member.id === selectedMember).map(member =>
                    <MemberRow key={member.id} member={member} teamId={result.team.id} scanProof={result.scanProof} onSaved={onMemberSaved} />)}
                </ul>
              </> : <p className="portal-card__hint">Whole team registered. No more registration scans are needed.</p>}
              <button type="button" className="portal-logout portal-u-mt" onClick={reset}>
                Scan next participant / team
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
