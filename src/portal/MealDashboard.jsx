import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import RequireRole from "./RequireRole";
import QrScanner from "./QrScanner";
import { MEAL_SLOTS } from "./mealSlots";
import { logout, mealLog, mealLookup } from "./api";

function MealHome({ session }) {
  const navigate = useNavigate();
  const [slotCode, setSlotCode] = useState(MEAL_SLOTS[0].code);
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState(null); // { team, slot, members }
  const [selected, setSelected] = useState(() => new Set());
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
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

        {scanning ? (
          <QrScanner onDecode={onDecode} paused={!scanning} />
        ) : (
          result && (
            <div className="portal-scanResult">
              <h4>
                {result.team.teamCode} · Seat {result.team.seatNo ?? "—"}
              </h4>
              <p className="portal-card__hint">Tick who's actually here for {result.slot.label}.</p>
              <ul className="portal-checklist">
                {result.members.map((m) => (
                  <li key={m.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selected.has(m.id)}
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
            </div>
          )
        )}
      </section>
    </div>
  );
}

export default function MealDashboard() {
  return <RequireRole role="meal">{(session) => <MealHome session={session} />}</RequireRole>;
}
