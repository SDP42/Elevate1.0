import TeamSearch from "./TeamSearch";
import useStaffSnapshot, { notifyStaffWrite } from "./useStaffSnapshot";
import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import RequireRole from "./RequireRole";
import QrScanner from "./QrScanner";
import MealHistory from "./MealHistory";
import { MealCelebration } from "./MealCelebration";
import { MEAL_SLOTS } from "./mealSlots";
import { logout, mealLog, mealLogGuest, mealLookup, mealLookupByCode, mealUndo } from "./api";

function GuestOverride({ teamId, slotCode }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function send(e) {
    e.preventDefault();
    if (!note.trim()) return;
    setBusy(true);
    try {
      await mealLogGuest(teamId, slotCode, note.trim());
      setSent(true);
      setNote("");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="portal-logout"
        onClick={() => {
          setOpen(true);
          setSent(false);
        }}
      >
        Guest / extra headcount
      </button>
    );
  }

  return (
    <form className="portal-manualLookup__row portal-u-mt" onSubmit={send}>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. 1 guest not on roster, served"
      />
      <button type="submit" className="portal-auth__submit" disabled={busy || !note.trim()}>
        {busy ? "Logging…" : sent ? "Logged ✓" : "Log"}
      </button>
      <button type="button" className="portal-logout" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </form>
  );
}

function MealHome({ session }) {
  const navigate = useNavigate();
  const [slotCode, setSlotCode] = useState(MEAL_SLOTS[0].code);
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState(null); // { team, slot, members }
  const [selected, setSelected] = useState(() => new Set());
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const staff = useStaffSnapshot("meal", slotCode);
  const [undoing, setUndoing] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [celebration, setCelebration] = useState(null);
  const busyRef = useRef(false);

  const onDecode = useCallback(
    async (payload) => {
      if (busyRef.current || !scanning) return;
      busyRef.current = true;
      setError("");
      try {
        const data = await mealLookup(payload, slotCode);
        setResult(data);
        setSelected(new Set(data.members.filter((m) => !m.alreadyGiven && m.registered).slice(0, 1).map((m) => m.id)));
        setScanning(false);
      } catch (err) {
        setError(err.message);
      } finally {
        busyRef.current = false;
      }
    },
    [scanning, slotCode]
  );

  async function lookUpManually(manualCode) {
    if (!manualCode.trim() || busyRef.current) return;
    busyRef.current = true;
    setManualBusy(true);
    setError("");
    try {
      const data = await mealLookupByCode(manualCode.trim(), slotCode);
      setResult(data);
      setSelected(new Set(data.members.filter((m) => !m.alreadyGiven && m.registered).slice(0, 1).map((m) => m.id)));
      setScanning(false);
    } catch (err) {
      setError(err.message);
    } finally {
      busyRef.current = false;
      setManualBusy(false);
    }
  }

  function toggleMember(id) { setSelected(new Set([id])); }

  async function confirm() {
    if (!result || selected.size === 0 || busyRef.current) return;
    busyRef.current = true; setConfirmBusy(true); setError("");
    try {
      const receipt = await mealLog(result.team.id, slotCode, [...selected], result.scanProof);
      setStatus(receipt.logged > 0
        ? `Recorded ${result.slot.label} for ${result.team.teamCode} (${receipt.logged} participants).`
        : "These participants have already been served for this meal.");
      if(receipt.logged > 0) notifyStaffWrite();
      const names = result.members.filter(member => receipt.memberIds.includes(member.id)).map(member => member.name);
      const slotLabel = result.slot.label;
      reset();
      if (receipt.logged > 0) {
        setScanning(false);
        setCelebration({ slotLabel, names });
      }
    } catch (err) { setError(err.message); }
    finally { busyRef.current = false; setConfirmBusy(false); }
  }

  async function handleUndo(memberId, memberName) {
    if (!window.confirm(`Undo meal for ${memberName}?`)) return;
    setUndoing(memberId);
    setError("");
    try {
      await mealUndo(result.team.id, slotCode, memberId);
      setStatus(`Reverted ${result.slot.label} for ${memberName}.`);
      setResult((prev) => ({
        ...prev,
        members: prev.members.map((m) =>
          m.id === memberId ? { ...m, alreadyGiven: false } : m
        ),
      }));
      notifyStaffWrite();
    } catch (err) {
      setError(err.message);
    } finally {
      setUndoing(null);
    }
  }

  function reset() {
    setResult(null);
    setSelected(new Set());
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
          <span className="portal-page__eyebrow">Elevate 1.0 · Meal Counter</span>
          <h1>{session.displayName}</h1>
        </div>
        <button type="button" className="portal-logout" onClick={onLogout}>
          Log out
        </button>
      </div>

      <section className="portal-card">
        <h3>Scan for a meal</h3>
        <p className="portal-card__hint">Use the same team QR once per participant. Each accepted scan records one serving.</p>

        <label className="portal-field portal-field--inline">
          <span>Meal slot</span>
          <select
            value={slotCode}
            disabled={confirmBusy}
            onChange={(e) => {
              setSlotCode(e.target.value);
              reset();
            }}
          >
            {MEAL_SLOTS.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        {status && <p className="portal-status">{status}</p>}
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
              {result.team.dietary && <p className="portal-dietaryFlag portal-u-mt">⚠ Dietary note: {result.team.dietary}</p>}
              <p className="portal-status">{result.progress.served} of {result.progress.total} served · {result.slot.label}</p>
              <p className="portal-card__hint portal-u-mt">Select the participant receiving this serving, then scan the same team QR for the next person.</p>
              <ul className="portal-checklist">
                {result.members.map((m) => (
                  <li key={m.id} className={m.alreadyGiven ? "is-served" : undefined}>
                    <label>
                      <input
                        type="radio"
                        name="meal-participant"
                        checked={selected.has(m.id)}
                        disabled={m.alreadyGiven || !m.registered || confirmBusy}
                        onChange={() => toggleMember(m.id)}
                      />
                      {m.name}
                      {m.foodPreference && <span className={`meal-diet${m.foodPreference === "Jain" ? " meal-diet--jain" : ""}`}>{m.foodPreference}</span>}
                      {!m.registered && <em> · Not registered yet</em>}
                      {m.alreadyGiven && <em> · already served</em>}
                    </label>
                    {m.alreadyGiven && (
                      <button
                        type="button"
                        className="portal-logout portal-u-ml"
                        onClick={() => handleUndo(m.id, m.name)}
                        disabled={undoing === m.id}
                      >
                        {undoing === m.id ? "Reverting…" : "Undo"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <div className="portal-scanResult__actions">
                <button type="button" className="portal-auth__submit" onClick={confirm} disabled={selected.size === 0 || confirmBusy || undoing !== null}>
                  {confirmBusy ? "Recording…" : "Confirm this scan"}
                </button>
                <button type="button" className="portal-logout" onClick={reset} disabled={confirmBusy}>
                  Cancel / scan next
                </button>
              </div>
              <GuestOverride teamId={result.team.id} slotCode={slotCode} />
            </div>
          )
        )}
      </section>

      <MealHistory snapshot={staff} slotCode={slotCode} onSelectSlot={code=>{setSlotCode(code);reset();}} />
      {celebration && <MealCelebration meal={celebration} onDone={() => { setCelebration(null); reset(); }} />}
    </div>
  );
}

export default function MealDashboard() {
  return <RequireRole role="meal">{(session) => <MealHome session={session} />}</RequireRole>;
}
