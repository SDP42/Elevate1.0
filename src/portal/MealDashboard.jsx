import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import RequireRole from "./RequireRole";
import QrScanner from "./QrScanner";
import { MEAL_SLOTS } from "./mealSlots";
import { logout, mealFlagLowStock, mealLog, mealLogGuest, mealLookup, mealLookupByCode, mealTally } from "./api";

function LowStockFlag({ slotCode }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function send(e) {
    e.preventDefault();
    if (!note.trim()) return;
    setBusy(true);
    try {
      await mealFlagLowStock(slotCode, note.trim());
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
        Flag low stock
      </button>
    );
  }

  return (
    <form className="portal-manualLookup__row portal-u-mt" onSubmit={send}>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Running low on rice" />
      <button type="submit" className="portal-auth__submit" disabled={busy || !note.trim()}>
        {busy ? "Sending…" : sent ? "Sent ✓" : "Flag"}
      </button>
      <button type="button" className="portal-logout" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </form>
  );
}

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

function Tally({ refreshKey }) {
  const [slots, setSlots] = useState(null);

  useEffect(() => {
    mealTally()
      .then((d) => setSlots(d.slots))
      .catch(() => {});
  }, [refreshKey]);

  if (!slots) return null;

  return (
    <section className="portal-card">
      <h3>Served so far</h3>
      <p className="portal-card__hint">Across every team, every counter — updates after each confirm.</p>
      <ul className="portal-tally">
        {slots.map((s) => (
          <li key={s.code}>
            <span>
              Day {s.dayNo} · {s.label}
            </span>
            <strong>{s.served}</strong>
          </li>
        ))}
      </ul>
    </section>
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
  const [manualCode, setManualCode] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const [tallyKey, setTallyKey] = useState(0);
  const busyRef = useRef(false);

  const onDecode = useCallback(
    async (payload) => {
      if (busyRef.current || !scanning) return;
      busyRef.current = true;
      setError("");
      try {
        const data = await mealLookup(payload, slotCode);
        setResult(data);
        setSelected(new Set(data.members.filter((m) => !m.alreadyGiven).map((m) => m.id)));
        setScanning(false);
      } catch (err) {
        setError(err.message);
      } finally {
        busyRef.current = false;
      }
    },
    [scanning, slotCode]
  );

  async function lookUpManually(e) {
    e.preventDefault();
    if (!manualCode.trim()) return;
    setManualBusy(true);
    setError("");
    try {
      const data = await mealLookupByCode(manualCode.trim(), slotCode);
      setResult(data);
      setSelected(new Set(data.members.filter((m) => !m.alreadyGiven).map((m) => m.id)));
      setScanning(false);
      setManualCode("");
    } catch (err) {
      setError(err.message);
    } finally {
      setManualBusy(false);
    }
  }

  function toggleMember(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function confirm() {
    if (!result || selected.size === 0) return;
    try {
      await mealLog(result.team.id, slotCode, [...selected]);
      setStatus(`Logged ${result.slot.label} for ${result.team.teamCode} (${selected.size} member${selected.size === 1 ? "" : "s"}).`);
      setTallyKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
      return;
    }
    reset();
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

        <label className="portal-field portal-field--inline">
          <span>Meal slot</span>
          <select
            value={slotCode}
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

        <LowStockFlag slotCode={slotCode} />

        {scanning ? (
          <>
            <QrScanner onDecode={onDecode} paused={!scanning} />
            <form className="portal-manualLookup" onSubmit={lookUpManually}>
              <span className="portal-manualLookup__label">Camera not working? Look up by team code:</span>
              <div className="portal-manualLookup__row">
                <input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="e.g. T07"
                />
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
              {result.team.dietary && <p className="portal-dietaryFlag">⚠ Dietary note: {result.team.dietary}</p>}
              <p className="portal-card__hint">Tick who's actually here for {result.slot.label}.</p>
              <ul className="portal-checklist">
                {result.members.map((m) => (
                  <li key={m.id} className={m.alreadyGiven ? "is-served" : undefined}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selected.has(m.id)}
                        disabled={m.alreadyGiven}
                        onChange={() => toggleMember(m.id)}
                      />
                      {m.name}
                      {m.alreadyGiven && <em> · already served</em>}
                    </label>
                  </li>
                ))}
              </ul>
              <div className="portal-scanResult__actions">
                <button type="button" className="portal-auth__submit" onClick={confirm} disabled={selected.size === 0}>
                  Confirm ({selected.size})
                </button>
                <button type="button" className="portal-logout" onClick={reset}>
                  Cancel / scan next
                </button>
              </div>
              <GuestOverride teamId={result.team.id} slotCode={slotCode} />
            </div>
          )
        )}
      </section>

      <Tally refreshKey={tallyKey} />
    </div>
  );
}

export default function MealDashboard() {
  return <RequireRole role="meal">{(session) => <MealHome session={session} />}</RequireRole>;
}
