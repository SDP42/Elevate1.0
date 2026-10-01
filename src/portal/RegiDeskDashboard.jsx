import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import RequireRole from "./RequireRole";
import QrScanner from "./QrScanner";
import { logout, regideskLookup, regideskLookupByCode, regideskSave } from "./api";

function MemberRow({ member, teamId, onSaved }) {
  const [githubId, setGithubId] = useState(member.githubId);
  const [govtIdChecked, setGovtIdChecked] = useState(member.govtIdChecked);
  const [bagChecked, setBagChecked] = useState(member.bagChecked);
  const [notes, setNotes] = useState(member.notes);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await regideskSave(member.id, teamId, { githubId, govtIdChecked, bagChecked, notes });
      setSaved(true);
      onSaved(member.id, { githubId, govtIdChecked, bagChecked, notes });
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="portal-regiRow">
      <div className="portal-regiRow__name">
        {member.name}
        {member.isLead && <em>Lead</em>}
      </div>
      <label className="portal-regiRow__field">
        <span>GitHub ID</span>
        <input
          value={githubId}
          onChange={(e) => {
            setGithubId(e.target.value);
            setSaved(false);
          }}
          placeholder="username"
        />
      </label>
      <label className="portal-regiRow__check">
        <input
          type="checkbox"
          checked={govtIdChecked}
          onChange={(e) => {
            setGovtIdChecked(e.target.checked);
            setSaved(false);
          }}
        />
        Govt ID checked
      </label>
      <label className="portal-regiRow__check">
        <input
          type="checkbox"
          checked={bagChecked}
          onChange={(e) => {
            setBagChecked(e.target.checked);
            setSaved(false);
          }}
        />
        Bag checked
      </label>
      <label className="portal-regiRow__field">
        <span>Notes</span>
        <input
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setSaved(false);
          }}
          placeholder="Optional"
        />
      </label>
      <button type="button" className="portal-logout" onClick={save} disabled={saving}>
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
      </button>
    </li>
  );
}

function RegiDeskHome({ session }) {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const busyRef = useRef(false);

  const onDecode = useCallback(
    async (payload) => {
      if (busyRef.current || !scanning) return;
      busyRef.current = true;
      setError("");
      try {
        const data = await regideskLookup(payload);
        setResult(data);
        setScanning(false);
      } catch (err) {
        setError(err.message);
      } finally {
        busyRef.current = false;
      }
    },
    [scanning]
  );

  async function lookUpManually(e) {
    e.preventDefault();
    if (!manualCode.trim()) return;
    setManualBusy(true);
    setError("");
    try {
      const data = await regideskLookupByCode(manualCode.trim());
      setResult(data);
      setScanning(false);
      setManualCode("");
    } catch (err) {
      setError(err.message);
    } finally {
      setManualBusy(false);
    }
  }

  function onMemberSaved(memberId, details) {
    setResult((prev) => ({
      ...prev,
      members: prev.members.map((m) => (m.id === memberId ? { ...m, ...details } : m)),
    }));
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
          Scan the team's boarding pass, then record each member's GitHub ID, government ID check,
          and bag check as they arrive.
        </p>

        {error && <p className="portal-auth__error">{error}</p>}

        {scanning ? (
          <>
            <QrScanner onDecode={onDecode} paused={!scanning} />
            <form className="portal-manualLookup" onSubmit={lookUpManually}>
              <span className="portal-manualLookup__label">Camera not working? Look up by team code:</span>
              <div className="portal-manualLookup__row">
                <input value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="e.g. T07" />
                <button type="submit" className="portal-logout" disabled={manualBusy || !manualCode.trim()}>
                  {manualBusy ? "Looking up…" : "Look up"}
                </button>
              </div>
            </form>
          </>
        ) : (
          result && (
            <div className="portal-scanResult">
              <h4>
                {result.team.teamCode} · Seat {result.team.seatNo ?? "—"}
              </h4>
              <ul className="portal-regiList">
                {result.members.map((m) => (
                  <MemberRow key={m.id} member={m} teamId={result.team.id} onSaved={onMemberSaved} />
                ))}
              </ul>
              <button type="button" className="portal-logout" onClick={reset}>
                Done / scan next team
              </button>
            </div>
          )
        )}
      </section>
    </div>
  );
}

export default function RegiDeskDashboard() {
  return <RequireRole role="regidesk">{(session) => <RegiDeskHome session={session} />}</RequireRole>;
}
